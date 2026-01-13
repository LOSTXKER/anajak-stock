'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/types'
import { PEAKClient, mapVatTypeToPEAK, formatDateForPEAK } from '@/lib/integrations/peak'

// ============================================
// Integration Management
// ============================================

export interface IntegrationConfig {
  id: string
  name: string
  provider: string
  baseUrl: string
  active: boolean
  createdAt: Date
}

export async function getIntegrations(): Promise<ActionResult<IntegrationConfig[]>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }
  }

  try {
    const integrations = await prisma.eRPIntegration.findMany({
      select: {
        id: true,
        name: true,
        provider: true,
        baseUrl: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return { success: true, data: integrations }
  } catch (error) {
    console.error('Error getting integrations:', error)
    return { success: false, error: 'ไม่สามารถโหลดข้อมูลได้' }
  }
}

export async function createIntegration(data: {
  name: string
  provider: 'peak' | 'custom_erp'
  baseUrl: string
  clientId?: string
  clientSecret?: string
  apiKey?: string
  settings?: Record<string, unknown>
}): Promise<ActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }
  }

  try {
    const integration = await prisma.eRPIntegration.create({
      data: {
        name: data.name,
        provider: data.provider,
        baseUrl: data.baseUrl,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        apiKey: data.apiKey,
        settings: data.settings as object,
        active: true,
      },
    })

    return { success: true, data: { id: integration.id } }
  } catch (error) {
    console.error('Error creating integration:', error)
    return { success: false, error: 'ไม่สามารถสร้างการเชื่อมต่อได้' }
  }
}

export async function updateIntegration(
  id: string,
  data: {
    name?: string
    baseUrl?: string
    clientId?: string
    clientSecret?: string
    apiKey?: string
    active?: boolean
    settings?: Record<string, unknown>
  }
): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }
  }

  try {
    await prisma.eRPIntegration.update({
      where: { id },
      data: {
        ...data,
        settings: data.settings as object,
      },
    })

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Error updating integration:', error)
    return { success: false, error: 'ไม่สามารถอัพเดทได้' }
  }
}

export async function deleteIntegration(id: string): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }
  }

  try {
    await prisma.eRPIntegration.delete({
      where: { id },
    })

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Error deleting integration:', error)
    return { success: false, error: 'ไม่สามารถลบได้' }
  }
}

export async function testIntegration(id: string): Promise<ActionResult<{ message: string }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }
  }

  try {
    const integration = await prisma.eRPIntegration.findUnique({
      where: { id },
    })

    if (!integration) {
      return { success: false, error: 'ไม่พบการเชื่อมต่อ' }
    }

    if (integration.provider === 'peak') {
      const client = new PEAKClient({
        baseUrl: integration.baseUrl,
        clientId: integration.clientId || '',
        clientSecret: integration.clientSecret || '',
      })

      const result = await client.getClientToken()
      if (result.success && result.data) {
        // Update token
        await prisma.eRPIntegration.update({
          where: { id },
          data: {
            accessToken: result.data.accessToken,
            tokenExpiry: new Date(Date.now() + result.data.expiresIn * 1000),
          },
        })
        return { success: true, data: { message: 'เชื่อมต่อ PEAK สำเร็จ!' } }
      } else {
        return { success: false, error: result.error?.message || 'ไม่สามารถเชื่อมต่อได้' }
      }
    }

    return { success: true, data: { message: 'ทดสอบสำเร็จ' } }
  } catch (error) {
    console.error('Error testing integration:', error)
    return { success: false, error: 'ไม่สามารถทดสอบได้' }
  }
}

// ============================================
// PEAK Sync Functions
// ============================================

async function getPEAKClient(integrationId?: string): Promise<PEAKClient | null> {
  const integration = await prisma.eRPIntegration.findFirst({
    where: {
      provider: 'peak',
      active: true,
      ...(integrationId && { id: integrationId }),
    },
  })

  if (!integration) return null

  const client = new PEAKClient({
    baseUrl: integration.baseUrl,
    clientId: integration.clientId || '',
    clientSecret: integration.clientSecret || '',
    accessToken: integration.accessToken || undefined,
  })

  // Check if token expired
  if (!integration.accessToken || (integration.tokenExpiry && integration.tokenExpiry < new Date())) {
    const tokenResult = await client.getClientToken()
    if (tokenResult.success && tokenResult.data) {
      client.setAccessToken(tokenResult.data.accessToken)
      await prisma.eRPIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: tokenResult.data.accessToken,
          tokenExpiry: new Date(Date.now() + tokenResult.data.expiresIn * 1000),
        },
      })
    }
  }

  return client
}

// Sync a supplier to PEAK
export async function syncSupplierToPEAK(supplierId: string): Promise<ActionResult<{ externalId: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) {
      return { success: false, error: 'ไม่พบซัพพลายเออร์' }
    }

    const client = await getPEAKClient()
    if (!client) {
      return { success: false, error: 'ไม่พบการเชื่อมต่อ PEAK' }
    }

    const result = await client.createContact({
      code: supplier.code,
      name: supplier.name,
      type: 'SUPPLIER',
      taxId: supplier.taxId || undefined,
      email: supplier.email || undefined,
      phone: supplier.phone || undefined,
      address: supplier.address || undefined,
    })

    if (!result.success) {
      return { success: false, error: result.error?.message || 'ไม่สามารถซิงค์ได้' }
    }

    // Log the sync
    const integration = await prisma.eRPIntegration.findFirst({
      where: { provider: 'peak', active: true },
    })

    if (integration) {
      await prisma.eRPSyncLog.create({
        data: {
          integrationId: integration.id,
          direction: 'OUT',
          docType: 'SUPPLIER',
          localId: supplierId,
          externalId: result.data?.id,
          status: 'SUCCESS',
          requestData: { supplier },
          responseData: result.data as object,
        },
      })
    }

    return { success: true, data: { externalId: result.data?.id || '' } }
  } catch (error) {
    console.error('Error syncing supplier to PEAK:', error)
    return { success: false, error: 'ไม่สามารถซิงค์ได้' }
  }
}

// Sync a product to PEAK
export async function syncProductToPEAK(productId: string): Promise<ActionResult<{ externalId: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { unit: true },
    })

    if (!product) {
      return { success: false, error: 'ไม่พบสินค้า' }
    }

    const client = await getPEAKClient()
    if (!client) {
      return { success: false, error: 'ไม่พบการเชื่อมต่อ PEAK' }
    }

    const result = await client.createProduct({
      code: product.sku,
      name: product.name,
      type: 'PRODUCT',
      unitName: product.unit?.name || 'ชิ้น',
      cost: Number(product.lastCost),
      description: product.description || undefined,
    })

    if (!result.success) {
      return { success: false, error: result.error?.message || 'ไม่สามารถซิงค์ได้' }
    }

    return { success: true, data: { externalId: result.data?.id || '' } }
  } catch (error) {
    console.error('Error syncing product to PEAK:', error)
    return { success: false, error: 'ไม่สามารถซิงค์ได้' }
  }
}

// Sync PO to PEAK
export async function syncPOToPEAK(poId: string): Promise<ActionResult<{ externalId: string; docNo: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const po = await prisma.pO.findUnique({
      where: { id: poId },
      include: {
        supplier: true,
        lines: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!po) {
      return { success: false, error: 'ไม่พบใบสั่งซื้อ' }
    }

    const client = await getPEAKClient()
    if (!client) {
      return { success: false, error: 'ไม่พบการเชื่อมต่อ PEAK' }
    }

    const result = await client.createPurchaseOrder({
      docNo: po.poNumber,
      contactCode: po.supplier.code,
      issueDate: formatDateForPEAK(po.createdAt),
      dueDate: po.eta ? formatDateForPEAK(po.eta) : undefined,
      lines: po.lines.map((line) => ({
        productCode: line.product.sku,
        qty: Number(line.qty),
        unitPrice: Number(line.unitPrice),
      })),
      note: po.note || undefined,
      vatType: mapVatTypeToPEAK(po.vatType),
    })

    if (!result.success) {
      return { success: false, error: result.error?.message || 'ไม่สามารถซิงค์ได้' }
    }

    // Log the sync
    const integration = await prisma.eRPIntegration.findFirst({
      where: { provider: 'peak', active: true },
    })

    if (integration) {
      await prisma.eRPSyncLog.create({
        data: {
          integrationId: integration.id,
          direction: 'OUT',
          docType: 'PO',
          localId: poId,
          externalId: result.data?.id,
          status: 'SUCCESS',
          requestData: { po },
          responseData: result.data as object,
        },
      })
    }

    return {
      success: true,
      data: { externalId: result.data?.id || '', docNo: result.data?.docNo || '' },
    }
  } catch (error) {
    console.error('Error syncing PO to PEAK:', error)
    return { success: false, error: 'ไม่สามารถซิงค์ได้' }
  }
}

// Sync GRN to PEAK (as Expense)
export async function syncGRNToPEAK(grnId: string): Promise<ActionResult<{ externalId: string; docNo: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const grn = await prisma.gRN.findUnique({
      where: { id: grnId },
      include: {
        po: {
          include: {
            supplier: true,
          },
        },
        lines: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!grn) {
      return { success: false, error: 'ไม่พบใบรับสินค้า' }
    }

    const client = await getPEAKClient()
    if (!client) {
      return { success: false, error: 'ไม่พบการเชื่อมต่อ PEAK' }
    }

    const result = await client.createExpense({
      docNo: grn.grnNumber,
      contactCode: grn.po.supplier.code,
      issueDate: formatDateForPEAK(grn.receivedAt),
      lines: grn.lines.map((line) => ({
        productCode: line.product.sku,
        qty: Number(line.qtyReceived),
        unitPrice: Number(line.unitCost),
      })),
      note: grn.note || undefined,
      vatType: mapVatTypeToPEAK(grn.po.vatType),
    })

    if (!result.success) {
      return { success: false, error: result.error?.message || 'ไม่สามารถซิงค์ได้' }
    }

    // Log the sync
    const integration = await prisma.eRPIntegration.findFirst({
      where: { provider: 'peak', active: true },
    })

    if (integration) {
      await prisma.eRPSyncLog.create({
        data: {
          integrationId: integration.id,
          direction: 'OUT',
          docType: 'GRN',
          localId: grnId,
          externalId: result.data?.id,
          status: 'SUCCESS',
          requestData: { grn },
          responseData: result.data as object,
        },
      })
    }

    return {
      success: true,
      data: { externalId: result.data?.id || '', docNo: result.data?.docNo || '' },
    }
  } catch (error) {
    console.error('Error syncing GRN to PEAK:', error)
    return { success: false, error: 'ไม่สามารถซิงค์ได้' }
  }
}

// Get sync logs
export async function getSyncLogs(params?: {
  integrationId?: string
  docType?: string
  status?: string
  limit?: number
}): Promise<ActionResult<{
  logs: {
    id: string
    direction: string
    docType: string
    localId: string | null
    externalId: string | null
    status: string
    errorMessage: string | null
    createdAt: Date
  }[]
}>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const logs = await prisma.eRPSyncLog.findMany({
      where: {
        ...(params?.integrationId && { integrationId: params.integrationId }),
        ...(params?.docType && { docType: params.docType }),
        ...(params?.status && { status: params.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: params?.limit || 100,
      select: {
        id: true,
        direction: true,
        docType: true,
        localId: true,
        externalId: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    })

    return { success: true, data: { logs } }
  } catch (error) {
    console.error('Error getting sync logs:', error)
    return { success: false, error: 'ไม่สามารถโหลดข้อมูลได้' }
  }
}

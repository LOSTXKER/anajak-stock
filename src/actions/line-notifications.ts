'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { 
  LineClient, 
  FlexTemplates, 
  getLineClient, 
  createLineClient,
  type FlexBubble,
  type FlexContainer,
} from '@/lib/integrations/line'
import type { ActionResult } from '@/types'
import { revalidatePath } from 'next/cache'

// ============================================
// Settings Management
// ============================================

export interface LineSettings {
  enabled: boolean
  channelAccessToken: string
  channelSecret: string
  notifyLowStock: boolean
  notifyPRPending: boolean
  notifyPOStatus: boolean
  notifyMovementPosted: boolean
  notifyExpiring: boolean
  recipientUserIds: string[] // LINE User IDs to notify
}

const DEFAULT_LINE_SETTINGS: LineSettings = {
  enabled: false,
  channelAccessToken: '',
  channelSecret: '',
  notifyLowStock: true,
  notifyPRPending: true,
  notifyPOStatus: true,
  notifyMovementPosted: false,
  notifyExpiring: true,
  recipientUserIds: [],
}

export async function getLineSettings(): Promise<ActionResult<LineSettings>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'line_notification' },
    })

    if (!setting) {
      return { success: true, data: DEFAULT_LINE_SETTINGS }
    }

    const data = JSON.parse(setting.value) as Partial<LineSettings>
    return { 
      success: true, 
      data: { ...DEFAULT_LINE_SETTINGS, ...data } 
    }
  } catch (error) {
    console.error('Error getting LINE settings:', error)
    return { success: false, error: 'ไม่สามารถโหลดการตั้งค่าได้' }
  }
}

/**
 * Get LINE settings without requiring authentication (for webhook use)
 */
export async function getLineSettingsForWebhook(): Promise<ActionResult<LineSettings>> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'line_notification' },
    })

    if (!setting) {
      return { success: true, data: DEFAULT_LINE_SETTINGS }
    }

    const data = JSON.parse(setting.value) as Partial<LineSettings>
    return { 
      success: true, 
      data: { ...DEFAULT_LINE_SETTINGS, ...data } 
    }
  } catch (error) {
    console.error('Error getting LINE settings for webhook:', error)
    return { success: false, error: 'ไม่สามารถโหลดการตั้งค่าได้' }
  }
}

export async function updateLineSettings(settings: Partial<LineSettings>): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }
  }

  try {
    const currentResult = await getLineSettings()
    const currentSettings = currentResult.success ? currentResult.data : DEFAULT_LINE_SETTINGS

    const newSettings = { ...currentSettings, ...settings }

    await prisma.setting.upsert({
      where: { key: 'line_notification' },
      create: {
        key: 'line_notification',
        value: JSON.stringify(newSettings),
      },
      update: {
        value: JSON.stringify(newSettings),
      },
    })

    revalidatePath('/settings/notifications')
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Error updating LINE settings:', error)
    return { success: false, error: 'ไม่สามารถบันทึกการตั้งค่าได้' }
  }
}

export async function testLineConnection(token?: string): Promise<ActionResult<{ message: string }>> {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') {
    return { success: false, error: 'ไม่มีสิทธิ์เข้าถึง' }
  }

  try {
    let accessToken = token

    if (!accessToken) {
      const settingsResult = await getLineSettings()
      if (settingsResult.success && settingsResult.data.channelAccessToken) {
        accessToken = settingsResult.data.channelAccessToken
      }
    }

    if (!accessToken) {
      return { success: false, error: 'ไม่พบ Channel Access Token' }
    }

    // Test by getting bot info
    const response = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return { 
        success: false, 
        error: error.message || `HTTP ${response.status}: Token ไม่ถูกต้อง` 
      }
    }

    const botInfo = await response.json()
    return { 
      success: true, 
      data: { message: `เชื่อมต่อสำเร็จ! Bot: ${botInfo.displayName}` } 
    }
  } catch (error) {
    console.error('LINE connection test error:', error)
    return { success: false, error: 'ไม่สามารถเชื่อมต่อ LINE ได้' }
  }
}

// ============================================
// Send Notifications
// ============================================

async function getLineClientFromSettings(): Promise<LineClient | null> {
  const settingsResult = await getLineSettings()
  
  if (!settingsResult.success || !settingsResult.data.enabled) {
    return null
  }

  const { channelAccessToken } = settingsResult.data

  if (!channelAccessToken) {
    // Try environment variable
    return getLineClient()
  }

  return createLineClient({ channelAccessToken })
}

async function getRecipientIds(): Promise<string[]> {
  const settingsResult = await getLineSettings()
  
  if (!settingsResult.success) {
    return []
  }

  return settingsResult.data.recipientUserIds || []
}

/**
 * Send Low Stock Alert via LINE
 */
export async function sendLineLowStockAlert(): Promise<ActionResult<void>> {
  try {
    const settingsResult = await getLineSettings()
    if (!settingsResult.success || !settingsResult.data.enabled || !settingsResult.data.notifyLowStock) {
      return { success: true, data: undefined } // Silently skip if disabled
    }

    const client = await getLineClientFromSettings()
    if (!client) {
      return { success: false, error: 'LINE not configured' }
    }

    const recipientIds = await getRecipientIds()
    if (recipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    // Get low stock items (only STOCKED products)
    const products = await prisma.product.findMany({
      where: {
        reorderPoint: { gt: 0 },
        active: true,
        deletedAt: null,
        stockType: 'STOCKED', // Only alert for stocked products
      },
      include: {
        stockBalances: true,
      },
    })

    const lowStockItems = products
      .map((product) => {
        const totalStock = product.stockBalances.reduce(
          (sum, sb) => sum + Number(sb.qtyOnHand),
          0
        )
        const rop = Number(product.reorderPoint)
        return {
          name: product.name,
          sku: product.sku,
          qty: totalStock,
          rop,
        }
      })
      .filter((item) => item.qty <= item.rop)
      .sort((a, b) => a.qty - b.qty)

    if (lowStockItems.length === 0) {
      return { success: true, data: undefined }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.lowStockAlert(lowStockItems, appUrl)

    const result = await client.sendFlex(
      recipientIds,
      `⚠️ สินค้าใกล้หมด ${lowStockItems.length} รายการ`,
      flexMessage
    )

    if (!result.success) {
      return { success: false, error: result.error || 'ไม่สามารถส่งแจ้งเตือนได้' }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE low stock alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send PR Pending Approval via LINE
 */
export async function sendLinePRPendingAlert(prId: string): Promise<ActionResult<void>> {
  try {
    const settingsResult = await getLineSettings()
    if (!settingsResult.success || !settingsResult.data.enabled || !settingsResult.data.notifyPRPending) {
      return { success: true, data: undefined }
    }

    const client = await getLineClientFromSettings()
    if (!client) {
      return { success: false, error: 'LINE not configured' }
    }

    const recipientIds = await getRecipientIds()
    if (recipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    const pr = await prisma.pR.findUnique({
      where: { id: prId },
      include: {
        requester: true,
        lines: true,
      },
    })

    if (!pr) {
      return { success: false, error: 'PR not found' }
    }

    // PRLine doesn't have estimatedPrice, just count items
    const totalItems = pr.lines.reduce(
      (sum, line) => sum + Number(line.qty),
      0
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.prApprovalRequest(
      {
        prNumber: pr.prNumber,
        requester: pr.requester.name,
        itemCount: pr.lines.length,
        totalAmount: undefined, // PRLine doesn't have price info
      },
      appUrl
    )

    const result = await client.sendFlex(
      recipientIds,
      `📋 ใบขอซื้อรออนุมัติ: ${pr.prNumber}`,
      flexMessage
    )

    if (!result.success) {
      return { success: false, error: result.error || 'ไม่สามารถส่งแจ้งเตือนได้' }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE PR alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send PO Status Update via LINE
 */
export async function sendLinePOStatusUpdate(poId: string, status: string): Promise<ActionResult<void>> {
  try {
    const settingsResult = await getLineSettings()
    if (!settingsResult.success || !settingsResult.data.enabled || !settingsResult.data.notifyPOStatus) {
      return { success: true, data: undefined }
    }

    const client = await getLineClientFromSettings()
    if (!client) {
      return { success: false, error: 'LINE not configured' }
    }

    const recipientIds = await getRecipientIds()
    if (recipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    const po = await prisma.pO.findUnique({
      where: { id: poId },
      include: {
        supplier: true,
      },
    })

    if (!po) {
      return { success: false, error: 'PO not found' }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.poStatusUpdate(
      {
        poNumber: po.poNumber,
        supplier: po.supplier.name,
        status,
        eta: po.eta ? new Date(po.eta).toLocaleDateString('th-TH') : undefined,
      },
      appUrl
    )

    const result = await client.sendFlex(
      recipientIds,
      `📦 อัพเดท PO: ${po.poNumber}`,
      flexMessage
    )

    if (!result.success) {
      return { success: false, error: result.error || 'ไม่สามารถส่งแจ้งเตือนได้' }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE PO alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send Movement Posted via LINE
 */
export async function sendLineMovementPosted(movementId: string): Promise<ActionResult<void>> {
  try {
    const settingsResult = await getLineSettings()
    if (!settingsResult.success || !settingsResult.data.enabled || !settingsResult.data.notifyMovementPosted) {
      return { success: true, data: undefined }
    }

    const client = await getLineClientFromSettings()
    if (!client) {
      return { success: false, error: 'LINE not configured' }
    }

    const recipientIds = await getRecipientIds()
    if (recipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    const movement = await prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: {
        createdBy: true,
        lines: true,
      },
    })

    if (!movement) {
      return { success: false, error: 'Movement not found' }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.movementPosted(
      {
        docNumber: movement.docNumber,
        type: movement.type,
        itemCount: movement.lines.length,
        createdBy: movement.createdBy.name,
      },
      appUrl
    )

    const result = await client.sendFlex(
      recipientIds,
      `📦 ${movement.type}: ${movement.docNumber}`,
      flexMessage
    )

    if (!result.success) {
      return { success: false, error: result.error || 'ไม่สามารถส่งแจ้งเตือนได้' }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE movement alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send Expiring Stock Alert via LINE
 */
export async function sendLineExpiringAlert(): Promise<ActionResult<void>> {
  try {
    const settingsResult = await getLineSettings()
    if (!settingsResult.success || !settingsResult.data.enabled || !settingsResult.data.notifyExpiring) {
      return { success: true, data: undefined }
    }

    const client = await getLineClientFromSettings()
    if (!client) {
      return { success: false, error: 'LINE not configured' }
    }

    const recipientIds = await getRecipientIds()
    if (recipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    // Get expiring lots (within 30 days)
    const thirtyDaysLater = new Date()
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

    const expiringLots = await prisma.lot.findMany({
      where: {
        expiryDate: {
          lte: thirtyDaysLater,
          gte: new Date(),
        },
        balances: {
          some: {
            qtyOnHand: { gt: 0 },
          },
        },
      },
      include: {
        product: true,
      },
      orderBy: { expiryDate: 'asc' },
    })

    if (expiringLots.length === 0) {
      return { success: true, data: undefined }
    }

    const items = expiringLots.map((lot) => ({
      name: lot.product.name,
      lotNumber: lot.lotNumber,
      expiryDate: lot.expiryDate!.toLocaleDateString('th-TH'),
      daysLeft: Math.ceil((lot.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    }))

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.expiringStockAlert(items, appUrl)

    const result = await client.sendFlex(
      recipientIds,
      `⏰ สินค้าใกล้หมดอายุ ${items.length} รายการ`,
      flexMessage
    )

    if (!result.success) {
      return { success: false, error: result.error || 'ไม่สามารถส่งแจ้งเตือนได้' }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE expiring alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send Custom Message via LINE
 */
export async function sendLineCustomMessage(
  title: string,
  message: string,
  buttonLabel?: string,
  buttonUrl?: string
): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const client = await getLineClientFromSettings()
    if (!client) {
      return { success: false, error: 'LINE not configured' }
    }

    const recipientIds = await getRecipientIds()
    if (recipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    const flexMessage = FlexTemplates.customCard(title, message, buttonLabel, buttonUrl)

    const result = await client.sendFlex(
      recipientIds,
      title,
      flexMessage
    )

    if (!result.success) {
      return { success: false, error: result.error || 'ไม่สามารถส่งแจ้งเตือนได้' }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE custom message error:', error)
    return { success: false, error: 'ไม่สามารถส่งข้อความได้' }
  }
}

/**
 * Send Simple Text Message via LINE
 */
export async function sendLineTextMessage(text: string): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const client = await getLineClientFromSettings()
    if (!client) {
      return { success: false, error: 'LINE not configured' }
    }

    const recipientIds = await getRecipientIds()
    if (recipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    const result = await client.sendText(recipientIds, text)

    if (!result.success) {
      return { success: false, error: result.error || 'ไม่สามารถส่งแจ้งเตือนได้' }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE text message error:', error)
    return { success: false, error: 'ไม่สามารถส่งข้อความได้' }
  }
}

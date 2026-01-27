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
import { 
  shouldNotifyUser,
  getUserLineId,
  filterLineRecipientsByPreferences,
  type NotificationTypeKey 
} from '@/actions/user-notification-preferences'

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
 * Sends to global recipients and individual users based on their preferences
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

    // Get low stock items first
    const products = await prisma.product.findMany({
      where: {
        active: true,
        deletedAt: null,
        OR: [
          { hasVariants: false, stockType: 'STOCKED', reorderPoint: { gt: 0 } },
          { hasVariants: true },
        ],
      },
      include: {
        stockBalances: { where: { variantId: null } },
        variants: {
          where: { active: true, deletedAt: null, stockType: 'STOCKED' },
          include: { stockBalances: true },
        },
      },
    })

    const lowStockItems: { name: string; sku: string; qty: number; rop: number }[] = []

    for (const product of products) {
      if (!product.hasVariants) {
        const totalStock = product.stockBalances.reduce(
          (sum, sb) => sum + Number(sb.qtyOnHand),
          0
        )
        const rop = Number(product.reorderPoint)
        if (rop > 0 && totalStock <= rop) {
          lowStockItems.push({
            name: product.name,
            sku: product.sku,
            qty: totalStock,
            rop,
          })
        }
      } else {
        for (const variant of product.variants) {
          const totalStock = variant.stockBalances.reduce(
            (sum, sb) => sum + Number(sb.qtyOnHand),
            0
          )
          const rop = Number(variant.reorderPoint) || Number(product.reorderPoint)
          if (rop > 0 && totalStock <= rop) {
            lowStockItems.push({
              name: `${product.name} - ${variant.name || variant.sku}`,
              sku: variant.sku,
              qty: totalStock,
              rop,
            })
          }
        }
      }
    }

    lowStockItems.sort((a, b) => a.qty - b.qty)

    if (lowStockItems.length === 0) {
      return { success: true, data: undefined }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.lowStockAlert(lowStockItems, appUrl)
    const altText = `⚠️ สินค้าใกล้หมด ${lowStockItems.length} รายการ`

    // Send to global recipients
    const globalRecipientIds = await getRecipientIds()
    const tasks: Promise<unknown>[] = []

    if (globalRecipientIds.length > 0) {
      tasks.push(client.sendFlex(globalRecipientIds, altText, flexMessage))
    }

    // Also send to individual users who have LINE enabled for lowStock
    const users = await prisma.user.findMany({
      where: {
        active: true,
        deletedAt: null,
        role: { in: ['ADMIN', 'APPROVER', 'INVENTORY'] },
      },
      select: { id: true },
    })

    for (const user of users) {
      const shouldSend = await shouldNotifyUser(user.id, 'lowStock', 'line')
      if (shouldSend) {
        const lineUserId = await getUserLineId(user.id)
        if (lineUserId && !globalRecipientIds.includes(lineUserId)) {
          tasks.push(client.sendFlex([lineUserId], altText, flexMessage))
        }
      }
    }

    await Promise.allSettled(tasks)

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

    const allRecipientIds = await getRecipientIds()
    if (allRecipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    // Filter recipients based on their notification preferences
    const recipientIds = await filterLineRecipientsByPreferences(allRecipientIds, 'prPending')
    if (recipientIds.length === 0) {
      return { success: true, data: undefined } // All recipients have disabled this notification
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
 * Map PO status string to notification type key
 */
function mapPOStatusToNotificationType(status: string): NotificationTypeKey | null {
  const statusMap: Record<string, NotificationTypeKey> = {
    'รออนุมัติ': 'poPending',
    'อนุมัติแล้ว': 'poApproved',
    'ไม่อนุมัติ': 'poRejected',
    'ส่งให้ Supplier แล้ว': 'poSent',
    'ยกเลิกแล้ว': 'poCancelled',
  }
  return statusMap[status] || null
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

    const allRecipientIds = await getRecipientIds()
    if (allRecipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    // Map status to notification type and filter recipients
    const notificationType = mapPOStatusToNotificationType(status)
    let recipientIds = allRecipientIds
    
    if (notificationType) {
      recipientIds = await filterLineRecipientsByPreferences(allRecipientIds, notificationType)
      if (recipientIds.length === 0) {
        return { success: true, data: undefined } // All recipients have disabled this notification
      }
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

    const allRecipientIds = await getRecipientIds()
    if (allRecipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    // Filter recipients based on their notification preferences
    const recipientIds = await filterLineRecipientsByPreferences(allRecipientIds, 'movementPosted')
    if (recipientIds.length === 0) {
      return { success: true, data: undefined } // All recipients have disabled this notification
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
 * Send Movement Pending (Waiting for approval) Alert via LINE
 */
export async function sendLineMovementPending(movementId: string): Promise<ActionResult<void>> {
  try {
    const settingsResult = await getLineSettings()
    if (!settingsResult.success || !settingsResult.data.enabled) {
      return { success: true, data: undefined }
    }

    const client = await getLineClientFromSettings()
    if (!client) {
      return { success: false, error: 'LINE not configured' }
    }

    const allRecipientIds = await getRecipientIds()
    if (allRecipientIds.length === 0) {
      return { success: false, error: 'No recipients configured' }
    }

    // Filter recipients based on their notification preferences
    const recipientIds = await filterLineRecipientsByPreferences(allRecipientIds, 'movementPending')
    if (recipientIds.length === 0) {
      return { success: true, data: undefined } // All recipients have disabled this notification
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
    const flexMessage = FlexTemplates.movementPending(
      {
        docNumber: movement.docNumber,
        type: movement.type,
        itemCount: movement.lines.length,
        submittedBy: movement.createdBy.name,
        movementId: movement.id,
      },
      appUrl
    )

    const result = await client.sendFlex(
      recipientIds,
      `⏳ ${movement.type}รอดำเนินการ: ${movement.docNumber}`,
      flexMessage
    )

    if (!result.success) {
      return { success: false, error: result.error || 'ไม่สามารถส่งแจ้งเตือนได้' }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE movement pending alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send Expiring Stock Alert via LINE
 * Sends to global recipients and individual users based on their preferences
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
    const altText = `⏰ สินค้าใกล้หมดอายุ ${items.length} รายการ`

    // Send to global recipients
    const globalRecipientIds = await getRecipientIds()
    const tasks: Promise<unknown>[] = []

    if (globalRecipientIds.length > 0) {
      tasks.push(client.sendFlex(globalRecipientIds, altText, flexMessage))
    }

    // Also send to individual users who have LINE enabled for expiring
    const users = await prisma.user.findMany({
      where: {
        active: true,
        deletedAt: null,
        role: { in: ['ADMIN', 'APPROVER', 'INVENTORY'] },
      },
      select: { id: true },
    })

    for (const user of users) {
      const shouldSend = await shouldNotifyUser(user.id, 'expiring', 'line')
      if (shouldSend) {
        const lineUserId = await getUserLineId(user.id)
        if (lineUserId && !globalRecipientIds.includes(lineUserId)) {
          tasks.push(client.sendFlex([lineUserId], altText, flexMessage))
        }
      }
    }

    await Promise.allSettled(tasks)

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

// ============================================
// Individual User Notifications
// ============================================

type NotificationData = {
  // PR
  prId?: string
  prNumber?: string
  requesterName?: string
  approverName?: string
  reason?: string
  // PO
  poId?: string
  poNumber?: string
  supplierName?: string
  status?: string
  eta?: string
  // Movement
  movementId?: string
  docNumber?: string
  type?: string
  itemCount?: number
  // Low Stock
  lowStockItems?: { name: string; sku: string; qty: number; rop: number }[]
}

/**
 * Send LINE notification to a specific user based on notification type
 * Used when respecting individual user preferences
 */
export async function sendLineNotificationToUser(
  lineUserId: string,
  notificationType: string,
  data: NotificationData
): Promise<ActionResult<void>> {
  try {
    const client = await getLineClientFromSettings()
    if (!client) {
      return { success: false, error: 'LINE not configured' }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let flexMessage: FlexContainer
    let altText: string

    switch (notificationType) {
      case 'prPending':
        flexMessage = FlexTemplates.prApprovalRequest(
          {
            prNumber: data.prNumber || '',
            requester: data.requesterName || '',
            itemCount: 0,
            totalAmount: undefined,
          },
          appUrl
        )
        altText = `📋 ใบขอซื้อรออนุมัติ: ${data.prNumber}`
        break

      case 'prApproved':
        flexMessage = FlexTemplates.customCard(
          `✅ PR ${data.prNumber} อนุมัติแล้ว`,
          `ใบขอซื้อ ${data.prNumber} ได้รับการอนุมัติโดย ${data.approverName}`,
          'ดูรายละเอียด',
          `${appUrl}/pr/${data.prId}`
        )
        altText = `✅ PR ${data.prNumber} อนุมัติแล้ว`
        break

      case 'prRejected':
        flexMessage = FlexTemplates.customCard(
          `❌ PR ${data.prNumber} ถูกปฏิเสธ`,
          data.reason 
            ? `ใบขอซื้อถูกปฏิเสธโดย ${data.approverName}: ${data.reason}`
            : `ใบขอซื้อถูกปฏิเสธโดย ${data.approverName}`,
          'ดูรายละเอียด',
          `${appUrl}/pr/${data.prId}`
        )
        altText = `❌ PR ${data.prNumber} ถูกปฏิเสธ`
        break

      case 'poPending':
        flexMessage = FlexTemplates.customCard(
          `📦 PO ใหม่รออนุมัติ`,
          `ใบสั่งซื้อ ${data.poNumber} รออนุมัติ`,
          'ดูรายละเอียด',
          `${appUrl}/po/${data.poId}`
        )
        altText = `📦 PO รออนุมัติ: ${data.poNumber}`
        break

      case 'poApproved':
        flexMessage = FlexTemplates.poStatusUpdate(
          {
            poNumber: data.poNumber || '',
            supplier: data.supplierName || '',
            status: 'อนุมัติแล้ว',
            eta: data.eta,
          },
          appUrl
        )
        altText = `✅ PO ${data.poNumber} อนุมัติแล้ว`
        break

      case 'poRejected':
        flexMessage = FlexTemplates.customCard(
          `❌ PO ${data.poNumber} ไม่อนุมัติ`,
          data.reason 
            ? `ใบสั่งซื้อไม่ได้รับการอนุมัติ: ${data.reason}`
            : `ใบสั่งซื้อไม่ได้รับการอนุมัติ`,
          'ดูรายละเอียด',
          `${appUrl}/po/${data.poId}`
        )
        altText = `❌ PO ${data.poNumber} ไม่อนุมัติ`
        break

      case 'poSent':
        flexMessage = FlexTemplates.poStatusUpdate(
          {
            poNumber: data.poNumber || '',
            supplier: data.supplierName || '',
            status: 'ส่งให้ Supplier แล้ว',
            eta: data.eta,
          },
          appUrl
        )
        altText = `📤 PO ${data.poNumber} ส่งแล้ว`
        break

      case 'poCancelled':
        flexMessage = FlexTemplates.customCard(
          `🚫 PO ${data.poNumber} ยกเลิก`,
          `ใบสั่งซื้อ ${data.poNumber} ถูกยกเลิกแล้ว`,
          'ดูรายละเอียด',
          `${appUrl}/po/${data.poId}`
        )
        altText = `🚫 PO ${data.poNumber} ยกเลิก`
        break

      case 'movementPending':
        flexMessage = FlexTemplates.movementPending(
          {
            docNumber: data.docNumber || '',
            type: data.type || '',
            itemCount: data.itemCount || 0,
            submittedBy: data.requesterName || '',
            movementId: data.movementId || '',
          },
          appUrl
        )
        altText = `⏳ ${data.type}รอดำเนินการ: ${data.docNumber}`
        break

      case 'movementPosted':
        flexMessage = FlexTemplates.movementPosted(
          {
            docNumber: data.docNumber || '',
            type: data.type || '',
            itemCount: data.itemCount || 0,
            createdBy: data.requesterName || '',
          },
          appUrl
        )
        altText = `📦 ${data.type}: ${data.docNumber}`
        break

      case 'lowStock':
        if (!data.lowStockItems || data.lowStockItems.length === 0) {
          return { success: true, data: undefined }
        }
        flexMessage = FlexTemplates.lowStockAlert(data.lowStockItems, appUrl)
        altText = `⚠️ สินค้าใกล้หมด ${data.lowStockItems.length} รายการ`
        break

      default:
        return { success: false, error: `Unknown notification type: ${notificationType}` }
    }

    const result = await client.sendFlex([lineUserId], altText, flexMessage)

    if (!result.success) {
      return { success: false, error: result.error || 'ไม่สามารถส่งแจ้งเตือนได้' }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE individual notification error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

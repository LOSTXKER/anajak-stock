'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { 
  FlexTemplates, 
  getLineClient, 
  createLineClient,
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
  recipientUserIds: string[] // LINE User IDs to notify
}

const DEFAULT_LINE_SETTINGS: LineSettings = {
  enabled: false,
  channelAccessToken: '',
  channelSecret: '',
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
// Core Notification Helpers
// ============================================

function getLineClientFromSettings(settingsData: LineSettings) {
  const { channelAccessToken } = settingsData

  if (!channelAccessToken) {
    return getLineClient()
  }

  return createLineClient({ channelAccessToken })
}

// Helper to map MovementType to notification prefix
function getMovementTypePrefix(type: string): string {
  const prefixMap: Record<string, string> = {
    RECEIVE: 'receive',
    ISSUE: 'issue',
    TRANSFER: 'transfer',
    ADJUST: 'adjust',
    RETURN: 'return',
  }
  return prefixMap[type] || 'receive'
}

// Map PO status string to notification type key
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
 * Core helper: send a flex message to global LINE recipients (filtered by preferences),
 * optionally also to individual users who opted in.
 * Eliminates the repeated boilerplate across all sendLine* functions.
 */
async function sendLineToRecipients(options: {
  notificationType: NotificationTypeKey
  altText: string
  flexMessage: FlexContainer
  /** Also query individual users and send to those who opted in for LINE */
  includeIndividualUsers?: boolean
}): Promise<{ recipientIds: string[]; success: boolean }> {
  const settingsResult = await getLineSettings()
  if (!settingsResult.success || !settingsResult.data.enabled) {
    return { recipientIds: [], success: true }
  }

  const client = getLineClientFromSettings(settingsResult.data)
  if (!client) {
    return { recipientIds: [], success: false }
  }

  // Get global recipients and filter by preferences
  const globalRecipientIds = settingsResult.data.recipientUserIds || []
  const filteredGlobalIds = await filterLineRecipientsByPreferences(
    globalRecipientIds,
    options.notificationType
  )

  // Collect all LINE IDs to send to (deduplicated)
  const allSendIds = new Set(filteredGlobalIds)

  // Optionally include individual users who opted in
  if (options.includeIndividualUsers) {
    const users = await prisma.user.findMany({
      where: {
        active: true,
        deletedAt: null,
        role: { in: ['ADMIN', 'APPROVER', 'INVENTORY'] },
      },
      select: { id: true },
    })

    for (const user of users) {
      const shouldSend = await shouldNotifyUser(user.id, options.notificationType, 'line')
      if (shouldSend) {
        const lineUserId = await getUserLineId(user.id)
        if (lineUserId) {
          allSendIds.add(lineUserId)
        }
      }
    }
  }

  const recipientIds = Array.from(allSendIds)
  if (recipientIds.length === 0) {
    return { recipientIds: [], success: true }
  }

  const result = await client.sendFlex(recipientIds, options.altText, options.flexMessage)
  return { recipientIds, success: result.success }
}

// ============================================
// Notification Template Registry
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

type TemplateResult = { altText: string; flex: FlexContainer }

const NOTIFICATION_TEMPLATES: Record<string, (data: NotificationData, appUrl: string) => TemplateResult | null> = {
  prPending: (data, appUrl) => ({
    altText: `📋 ใบขอซื้อรออนุมัติ: ${data.prNumber}`,
    flex: FlexTemplates.prApprovalRequest(
      { prNumber: data.prNumber || '', requester: data.requesterName || '', itemCount: 0, totalAmount: undefined },
      appUrl,
    ),
  }),
  prApproved: (data, appUrl) => ({
    altText: `✅ PR ${data.prNumber} อนุมัติแล้ว`,
    flex: FlexTemplates.customCard(
      `✅ PR ${data.prNumber} อนุมัติแล้ว`,
      `ใบขอซื้อ ${data.prNumber} ได้รับการอนุมัติโดย ${data.approverName}`,
      'ดูรายละเอียด',
      `${appUrl}/pr/${data.prId}`,
    ),
  }),
  prRejected: (data, appUrl) => ({
    altText: `❌ PR ${data.prNumber} ถูกปฏิเสธ`,
    flex: FlexTemplates.customCard(
      `❌ PR ${data.prNumber} ถูกปฏิเสธ`,
      data.reason
        ? `ใบขอซื้อถูกปฏิเสธโดย ${data.approverName}: ${data.reason}`
        : `ใบขอซื้อถูกปฏิเสธโดย ${data.approverName}`,
      'ดูรายละเอียด',
      `${appUrl}/pr/${data.prId}`,
    ),
  }),
  poPending: (data, appUrl) => ({
    altText: `📦 PO รออนุมัติ: ${data.poNumber}`,
    flex: FlexTemplates.customCard(
      `📦 PO ใหม่รออนุมัติ`,
      `ใบสั่งซื้อ ${data.poNumber} รออนุมัติ`,
      'ดูรายละเอียด',
      `${appUrl}/po/${data.poId}`,
    ),
  }),
  poApproved: (data, appUrl) => ({
    altText: `✅ PO ${data.poNumber} อนุมัติแล้ว`,
    flex: FlexTemplates.poStatusUpdate(
      { poNumber: data.poNumber || '', supplier: data.supplierName || '', status: 'อนุมัติแล้ว', eta: data.eta },
      appUrl,
    ),
  }),
  poRejected: (data, appUrl) => ({
    altText: `❌ PO ${data.poNumber} ไม่อนุมัติ`,
    flex: FlexTemplates.customCard(
      `❌ PO ${data.poNumber} ไม่อนุมัติ`,
      data.reason
        ? `ใบสั่งซื้อไม่ได้รับการอนุมัติ: ${data.reason}`
        : `ใบสั่งซื้อไม่ได้รับการอนุมัติ`,
      'ดูรายละเอียด',
      `${appUrl}/po/${data.poId}`,
    ),
  }),
  poSent: (data, appUrl) => ({
    altText: `📤 PO ${data.poNumber} ส่งแล้ว`,
    flex: FlexTemplates.poStatusUpdate(
      { poNumber: data.poNumber || '', supplier: data.supplierName || '', status: 'ส่งให้ Supplier แล้ว', eta: data.eta },
      appUrl,
    ),
  }),
  poCancelled: (data, appUrl) => ({
    altText: `🚫 PO ${data.poNumber} ยกเลิก`,
    flex: FlexTemplates.customCard(
      `🚫 PO ${data.poNumber} ยกเลิก`,
      `ใบสั่งซื้อ ${data.poNumber} ถูกยกเลิกแล้ว`,
      'ดูรายละเอียด',
      `${appUrl}/po/${data.poId}`,
    ),
  }),
  movementPending: (data, appUrl) => ({
    altText: `⏳ ${data.type}รอดำเนินการ: ${data.docNumber}`,
    flex: FlexTemplates.movementPending(
      { docNumber: data.docNumber || '', type: data.type || '', itemCount: data.itemCount || 0, submittedBy: data.requesterName || '', movementId: data.movementId || '' },
      appUrl,
    ),
  }),
  movementPosted: (data, appUrl) => ({
    altText: `📦 ${data.type}: ${data.docNumber}`,
    flex: FlexTemplates.movementPosted(
      { docNumber: data.docNumber || '', type: data.type || '', itemCount: data.itemCount || 0, createdBy: data.requesterName || '' },
      appUrl,
    ),
  }),
  lowStock: (data, appUrl) => {
    if (!data.lowStockItems || data.lowStockItems.length === 0) return null
    return {
      altText: `⚠️ สินค้าใกล้หมด ${data.lowStockItems.length} รายการ`,
      flex: FlexTemplates.lowStockAlert(data.lowStockItems, appUrl),
    }
  },
}

// ============================================
// Send Notifications - Simplified Functions
// ============================================

/**
 * Send Low Stock Alert via LINE
 * Data fetching is separated from notification sending.
 */
export async function sendLineLowStockAlert(): Promise<ActionResult<void>> {
  try {
    // 1. Fetch data (business logic)
    const lowStockItems = await getLowStockItems()
    if (lowStockItems.length === 0) {
      return { success: true, data: undefined }
    }

    // 2. Build message
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.lowStockAlert(lowStockItems, appUrl)
    const altText = `⚠️ สินค้าใกล้หมด ${lowStockItems.length} รายการ`

    // 3. Send via unified helper (global + individual users)
    const { recipientIds, success } = await sendLineToRecipients({
      notificationType: 'lowStock',
      altText,
      flexMessage,
      includeIndividualUsers: true,
    })

    // 4. Log delivery
    if (recipientIds.length > 0) {
      const { logNotificationDelivery } = await import('./notifications')
      await logNotificationDelivery({
        channel: 'LINE',
        type: 'low_stock',
        title: altText,
        message: `สินค้าใกล้หมด ${lowStockItems.length} รายการ`,
        url: '/reports/low-stock',
        recipientIds,
        success,
      })
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE low stock alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send Expiring Stock Alert via LINE
 * Data fetching is separated from notification sending.
 */
export async function sendLineExpiringAlert(): Promise<ActionResult<void>> {
  try {
    // 1. Fetch data (business logic)
    const items = await getExpiringItems()
    if (items.length === 0) {
      return { success: true, data: undefined }
    }

    // 2. Build message
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.expiringStockAlert(items, appUrl)
    const altText = `⏰ สินค้าใกล้หมดอายุ ${items.length} รายการ`

    // 3. Send via unified helper (global + individual users)
    await sendLineToRecipients({
      notificationType: 'expiring',
      altText,
      flexMessage,
      includeIndividualUsers: true,
    })

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE expiring alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send PR Pending Approval via LINE (global recipients)
 */
export async function sendLinePRPendingAlert(prId: string): Promise<ActionResult<void>> {
  try {
    const pr = await prisma.pR.findUnique({
      where: { id: prId },
      include: { requester: true, lines: true },
    })
    if (!pr) return { success: false, error: 'PR not found' }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.prApprovalRequest(
      { prNumber: pr.prNumber, requester: pr.requester.name, itemCount: pr.lines.length, totalAmount: undefined },
      appUrl,
    )

    const { success } = await sendLineToRecipients({
      notificationType: 'prPending',
      altText: `📋 ใบขอซื้อรออนุมัติ: ${pr.prNumber}`,
      flexMessage,
    })

    if (!success) {
      return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
    }
    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE PR alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send PO Status Update via LINE (global recipients)
 */
export async function sendLinePOStatusUpdate(poId: string, status: string): Promise<ActionResult<void>> {
  try {
    const po = await prisma.pO.findUnique({
      where: { id: poId },
      include: { supplier: true },
    })
    if (!po) return { success: false, error: 'PO not found' }

    const notificationType = mapPOStatusToNotificationType(status)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.poStatusUpdate(
      { poNumber: po.poNumber, supplier: po.supplier.name, status, eta: po.eta ? new Date(po.eta).toLocaleDateString('th-TH') : undefined },
      appUrl,
    )

    // If we have a notification type for this status, filter by preferences
    // Otherwise send to all global recipients
    if (notificationType) {
      const { success } = await sendLineToRecipients({
        notificationType,
        altText: `📦 อัพเดท PO: ${po.poNumber}`,
        flexMessage,
      })
      if (!success) {
        return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
      }
    } else {
      // Fallback: send without filtering
      const settingsResult = await getLineSettings()
      if (settingsResult.success && settingsResult.data.enabled) {
        const client = getLineClientFromSettings(settingsResult.data)
        if (client) {
          await client.sendFlex(settingsResult.data.recipientUserIds, `📦 อัพเดท PO: ${po.poNumber}`, flexMessage)
        }
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE PO alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send Movement Posted via LINE (global recipients)
 */
export async function sendLineMovementPosted(movementId: string): Promise<ActionResult<void>> {
  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: { createdBy: true, lines: true },
    })
    if (!movement) return { success: false, error: 'Movement not found' }

    const notificationType = `${getMovementTypePrefix(movement.type)}Posted` as NotificationTypeKey
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.movementPosted(
      { docNumber: movement.docNumber, type: movement.type, itemCount: movement.lines.length, createdBy: movement.createdBy.name },
      appUrl,
    )

    await sendLineToRecipients({
      notificationType,
      altText: `📦 ${movement.type}: ${movement.docNumber}`,
      flexMessage,
    })

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE movement alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

/**
 * Send Movement Pending Alert via LINE (global recipients)
 */
export async function sendLineMovementPending(movementId: string): Promise<ActionResult<void>> {
  try {
    const movement = await prisma.stockMovement.findUnique({
      where: { id: movementId },
      include: { createdBy: true, lines: true },
    })
    if (!movement) return { success: false, error: 'Movement not found' }

    const notificationType = `${getMovementTypePrefix(movement.type)}Pending` as NotificationTypeKey
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const flexMessage = FlexTemplates.movementPending(
      { docNumber: movement.docNumber, type: movement.type, itemCount: movement.lines.length, submittedBy: movement.createdBy.name, movementId: movement.id },
      appUrl,
    )

    await sendLineToRecipients({
      notificationType,
      altText: `⏳ ${movement.type}รอดำเนินการ: ${movement.docNumber}`,
      flexMessage,
    })

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE movement pending alert error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

// ============================================
// Individual User Notifications (Template-based)
// ============================================

/**
 * Send LINE notification to a specific user based on notification type.
 * Uses the template registry instead of a large switch statement.
 */
export async function sendLineNotificationToUser(
  lineUserId: string,
  notificationType: string,
  data: NotificationData
): Promise<ActionResult<void>> {
  try {
    const settingsResult = await getLineSettings()
    if (!settingsResult.success || !settingsResult.data.enabled) {
      return { success: true, data: undefined }
    }

    const client = getLineClientFromSettings(settingsResult.data)
    if (!client) {
      return { success: false, error: 'LINE not configured' }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const templateFn = NOTIFICATION_TEMPLATES[notificationType]

    if (!templateFn) {
      return { success: false, error: `Unknown notification type: ${notificationType}` }
    }

    const template = templateFn(data, appUrl)
    if (!template) {
      return { success: true, data: undefined } // Template returned null (e.g., no items)
    }

    const result = await client.sendFlex([lineUserId], template.altText, template.flex)

    if (!result.success) {
      return { success: false, error: result.error || 'ไม่สามารถส่งแจ้งเตือนได้' }
    }

    return { success: true, data: undefined }
  } catch (error) {
    console.error('LINE individual notification error:', error)
    return { success: false, error: 'ไม่สามารถส่งแจ้งเตือนได้' }
  }
}

// ============================================
// Custom/Test Messages (no refactoring needed)
// ============================================

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
    const settingsResult = await getLineSettings()
    if (!settingsResult.success || !settingsResult.data.enabled) {
      return { success: false, error: 'LINE not configured' }
    }

    const client = getLineClientFromSettings(settingsResult.data)
    if (!client) return { success: false, error: 'LINE not configured' }

    const recipientIds = settingsResult.data.recipientUserIds || []
    if (recipientIds.length === 0) return { success: false, error: 'No recipients configured' }

    const flexMessage = FlexTemplates.customCard(title, message, buttonLabel, buttonUrl)
    const result = await client.sendFlex(recipientIds, title, flexMessage)

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
    const settingsResult = await getLineSettings()
    if (!settingsResult.success || !settingsResult.data.enabled) {
      return { success: false, error: 'LINE not configured' }
    }

    const client = getLineClientFromSettings(settingsResult.data)
    if (!client) return { success: false, error: 'LINE not configured' }

    const recipientIds = settingsResult.data.recipientUserIds || []
    if (recipientIds.length === 0) return { success: false, error: 'No recipients configured' }

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
// Pending Actions Alert (special: uses webhook settings)
// ============================================

/**
 * Send pending actions alert via LINE
 */
export async function sendLinePendingActionsAlert(): Promise<ActionResult<{ sent: boolean; count: number }>> {
  try {
    const { getPendingActionsForCron } = await import('./pending-actions')
    
    const settingsResult = await getLineSettingsForWebhook()
    if (!settingsResult.success || !settingsResult.data) {
      return { success: false, error: 'ไม่สามารถโหลดการตั้งค่า LINE ได้' }
    }

    const settings = settingsResult.data
    if (!settings.enabled || settings.recipientUserIds.length === 0) {
      return { success: true, data: { sent: false, count: 0 } }
    }

    const pendingResult = await getPendingActionsForCron()
    if (!pendingResult.success || !pendingResult.data) {
      return { success: false, error: 'ไม่สามารถโหลดงานค้างได้' }
    }

    const pending = pendingResult.data
    if (pending.total === 0) {
      return { success: true, data: { sent: false, count: 0 } }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const client = createLineClient({
      channelAccessToken: settings.channelAccessToken,
      channelSecret: settings.channelSecret,
    })

    const summaryLines: string[] = []
    if (pending.grnDraft > 0) summaryLines.push(`📥 GRN รอบันทึก: ${pending.grnDraft}`)
    if (pending.poApproved > 0) summaryLines.push(`📦 PO รอส่ง Supplier: ${pending.poApproved}`)
    if (pending.poSent > 0) summaryLines.push(`🚚 PO เลย ETA: ${pending.poSent}`)
    if (pending.prSubmitted > 0) summaryLines.push(`📝 PR รออนุมัติ: ${pending.prSubmitted}`)
    if (pending.movementApproved > 0) summaryLines.push(`📋 Movement รอบันทึก: ${pending.movementApproved}`)
    if (pending.stockTakeCompleted > 0) summaryLines.push(`📊 ตรวจนับรออนุมัติ: ${pending.stockTakeCompleted}`)

    const flexMessage = FlexTemplates.customCard(
      `⚡ งานค้าง ${pending.total} รายการ`,
      summaryLines.join('\n'),
      'ดูรายละเอียด',
      `${appUrl}/dashboard`,
    )

    const recipientIds = settings.recipientUserIds
    const result = await client.sendFlex(recipientIds, `⚡ งานค้าง ${pending.total} รายการ`, flexMessage)

    // Log delivery
    const { logNotificationDelivery } = await import('./notifications')
    await logNotificationDelivery({
      channel: 'LINE',
      type: 'system',
      title: `⚡ งานค้าง ${pending.total} รายการ`,
      message: summaryLines.join(', '),
      url: '/dashboard',
      recipientIds,
      success: result.success,
      error: result.error,
    })

    if (!result.success) {
      return { success: false, error: result.error || 'ส่งแจ้งเตือนไม่สำเร็จ' }
    }

    return { success: true, data: { sent: true, count: pending.total } }
  } catch (error) {
    console.error('LINE pending actions alert error:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดในการส่งแจ้งเตือน' }
  }
}

// ============================================
// Data Fetching (separated from notification sending)
// ============================================

async function getLowStockItems(): Promise<{ name: string; sku: string; qty: number; rop: number }[]> {
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

  const items: { name: string; sku: string; qty: number; rop: number }[] = []

  for (const product of products) {
    if (!product.hasVariants) {
      const totalStock = product.stockBalances.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0)
      const rop = Number(product.reorderPoint)
      if (rop > 0 && totalStock <= rop) {
        items.push({ name: product.name, sku: product.sku, qty: totalStock, rop })
      }
    } else {
      for (const variant of product.variants) {
        const totalStock = variant.stockBalances.reduce((sum, sb) => sum + Number(sb.qtyOnHand), 0)
        const rop = Number(variant.reorderPoint) || Number(product.reorderPoint)
        if (rop > 0 && totalStock <= rop) {
          items.push({
            name: `${product.name} - ${variant.name || variant.sku}`,
            sku: variant.sku,
            qty: totalStock,
            rop,
          })
        }
      }
    }
  }

  return items.sort((a, b) => a.qty - b.qty)
}

async function getExpiringItems(): Promise<{ name: string; lotNumber: string; expiryDate: string; daysLeft: number }[]> {
  const thirtyDaysLater = new Date()
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30)

  const expiringLots = await prisma.lot.findMany({
    where: {
      expiryDate: { lte: thirtyDaysLater, gte: new Date() },
      balances: { some: { qtyOnHand: { gt: 0 } } },
    },
    include: { product: true },
    orderBy: { expiryDate: 'asc' },
  })

  return expiringLots.map((lot) => ({
    name: lot.product.name,
    lotNumber: lot.lotNumber,
    expiryDate: lot.expiryDate!.toLocaleDateString('th-TH'),
    daysLeft: Math.ceil((lot.expiryDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  }))
}

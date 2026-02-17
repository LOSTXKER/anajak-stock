'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { 
  FlexTemplates, 
  getLineClient, 
  createLineClient,
} from '@/lib/integrations/line'
import { getUserLineId } from '@/actions/user-notification-preferences'
import type { ActionResult } from '@/types'
import { revalidatePath } from 'next/cache'

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
 * Get LINE settings without requiring authentication (for webhook/cron use)
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
// Core LINE Client Helper
// ============================================

function getLineClientFromSettings(settingsData: LineSettings) {
  const { channelAccessToken } = settingsData

  if (!channelAccessToken) {
    return getLineClient()
  }

  return createLineClient({ channelAccessToken })
}



// ============================================
// Custom/Test Messages (not part of dispatch flow)
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

    const recipientIds = [...(settingsResult.data.recipientUserIds || [])]

    // Also include the caller's own LINE User ID
    const myLineId = await getUserLineId(session.id)
    if (myLineId && !recipientIds.includes(myLineId)) {
      recipientIds.push(myLineId)
    }

    if (recipientIds.length === 0) return { success: false, error: 'ไม่มีผู้รับ กรุณากรอก LINE User ID หรือเพิ่มผู้รับทั้งระบบ' }

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
// Data Fetching (used by cron dispatcher)
// ============================================

export async function getLowStockItems(): Promise<{ name: string; sku: string; qty: number; rop: number }[]> {
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

export async function getExpiringItems(): Promise<{ name: string; lotNumber: string; expiryDate: string; daysLeft: number }[]> {
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

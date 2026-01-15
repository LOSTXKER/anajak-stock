/**
 * LINE Messaging API Integration
 * 
 * Features:
 * - Send text messages
 * - Send Flex Messages (cards)
 * - Multicast to multiple users
 * - Push messages to individual users
 */

// ============================================
// Types
// ============================================

export interface LineConfig {
  channelAccessToken: string
  channelSecret?: string
}

export interface FlexBubble {
  type: 'bubble'
  header?: FlexBox
  hero?: FlexImage
  body?: FlexBox
  footer?: FlexBox
  styles?: {
    header?: BoxStyle
    hero?: BoxStyle
    body?: BoxStyle
    footer?: BoxStyle
  }
}

export interface FlexCarousel {
  type: 'carousel'
  contents: FlexBubble[]
}

export type FlexContainer = FlexBubble | FlexCarousel

interface FlexBox {
  type: 'box'
  layout: 'horizontal' | 'vertical' | 'baseline'
  contents: FlexComponent[]
  backgroundColor?: string
  paddingAll?: string
  paddingTop?: string
  paddingBottom?: string
  spacing?: string
  margin?: string
  action?: Action
}

interface FlexImage {
  type: 'image'
  url: string
  size?: string
  aspectRatio?: string
  aspectMode?: 'cover' | 'fit'
  action?: Action
}

interface FlexText {
  type: 'text'
  text: string
  size?: string
  color?: string
  weight?: 'regular' | 'bold'
  wrap?: boolean
  flex?: number
  align?: 'start' | 'center' | 'end'
  margin?: string
  action?: Action
}

interface FlexButton {
  type: 'button'
  action: Action
  style?: 'primary' | 'secondary' | 'link'
  color?: string
  height?: 'sm' | 'md'
  margin?: string
}

interface FlexSeparator {
  type: 'separator'
  margin?: string
  color?: string
}

interface FlexSpacer {
  type: 'spacer'
  size?: string
}

interface FlexFiller {
  type: 'filler'
}

interface FlexIcon {
  type: 'icon'
  url: string
  size?: string
  margin?: string
}

type FlexComponent = FlexBox | FlexImage | FlexText | FlexButton | FlexSeparator | FlexSpacer | FlexFiller | FlexIcon

interface BoxStyle {
  backgroundColor?: string
  separator?: boolean
  separatorColor?: string
}

interface Action {
  type: 'uri' | 'message' | 'postback'
  label?: string
  uri?: string
  text?: string
  data?: string
}

interface TextMessage {
  type: 'text'
  text: string
  quickReply?: QuickReply
}

interface FlexMessage {
  type: 'flex'
  altText: string
  contents: FlexContainer
  quickReply?: QuickReply
}

interface QuickReply {
  items: QuickReplyItem[]
}

interface QuickReplyItem {
  type: 'action'
  action: Action
}

type Message = TextMessage | FlexMessage

// ============================================
// LINE API Client
// ============================================

const LINE_API_BASE = 'https://api.line.me/v2/bot'

export class LineClient {
  private config: LineConfig

  constructor(config: LineConfig) {
    this.config = config
  }

  private async request(endpoint: string, body: object): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${LINE_API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.channelAccessToken}`,
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('LINE API error:', errorData)
        return { 
          success: false, 
          error: errorData.message || `HTTP ${response.status}` 
        }
      }

      return { success: true }
    } catch (error) {
      console.error('LINE API request failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Send push message to a single user
   */
  async pushMessage(userId: string, messages: Message[]): Promise<{ success: boolean; error?: string }> {
    return this.request('/message/push', {
      to: userId,
      messages,
    })
  }

  /**
   * Send multicast message to multiple users (max 500)
   */
  async multicast(userIds: string[], messages: Message[]): Promise<{ success: boolean; error?: string }> {
    if (userIds.length === 0) {
      return { success: false, error: 'No user IDs provided' }
    }

    if (userIds.length > 500) {
      // Split into batches
      const batches = []
      for (let i = 0; i < userIds.length; i += 500) {
        batches.push(userIds.slice(i, i + 500))
      }

      for (const batch of batches) {
        const result = await this.request('/message/multicast', {
          to: batch,
          messages,
        })
        if (!result.success) {
          return result
        }
      }
      return { success: true }
    }

    return this.request('/message/multicast', {
      to: userIds,
      messages,
    })
  }

  /**
   * Broadcast message to all friends
   */
  async broadcast(messages: Message[]): Promise<{ success: boolean; error?: string }> {
    return this.request('/message/broadcast', { messages })
  }

  /**
   * Send text message
   */
  async sendText(userIds: string[], text: string): Promise<{ success: boolean; error?: string }> {
    const message: TextMessage = { type: 'text', text }

    if (userIds.length === 1) {
      return this.pushMessage(userIds[0], [message])
    }
    return this.multicast(userIds, [message])
  }

  /**
   * Send Flex Message
   */
  async sendFlex(userIds: string[], altText: string, contents: FlexContainer): Promise<{ success: boolean; error?: string }> {
    const message: FlexMessage = {
      type: 'flex',
      altText,
      contents,
    }

    if (userIds.length === 1) {
      return this.pushMessage(userIds[0], [message])
    }
    return this.multicast(userIds, [message])
  }
}

// ============================================
// Flex Message Templates
// ============================================

export const FlexTemplates = {
  /**
   * Low Stock Alert Card
   */
  lowStockAlert(items: { name: string; sku: string; qty: number; rop: number }[], appUrl: string): FlexBubble {
    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '⚠️ สินค้าใกล้หมด',
            weight: 'bold',
            size: 'lg',
            color: '#f59e0b',
          },
          {
            type: 'text',
            text: `${items.length} รายการ`,
            size: 'sm',
            color: '#666666',
          },
        ],
        backgroundColor: '#fef3c7',
        paddingAll: 'lg',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: items.slice(0, 5).flatMap((item, index) => [
          ...(index > 0 ? [{ type: 'separator' as const, margin: 'md' }] : []),
          {
            type: 'box' as const,
            layout: 'horizontal' as const,
            contents: [
              {
                type: 'box' as const,
                layout: 'vertical' as const,
                contents: [
                  {
                    type: 'text' as const,
                    text: item.name,
                    size: 'sm',
                    weight: 'bold' as const,
                    wrap: true,
                  },
                  {
                    type: 'text' as const,
                    text: `SKU: ${item.sku}`,
                    size: 'xs',
                    color: '#888888',
                  },
                ],
                flex: 3,
              },
              {
                type: 'box' as const,
                layout: 'vertical' as const,
                contents: [
                  {
                    type: 'text' as const,
                    text: `${item.qty}`,
                    size: 'lg',
                    weight: 'bold' as const,
                    color: item.qty === 0 ? '#dc2626' : '#f59e0b',
                    align: 'end' as const,
                  },
                  {
                    type: 'text' as const,
                    text: `ROP: ${item.rop}`,
                    size: 'xs',
                    color: '#888888',
                    align: 'end' as const,
                  },
                ],
                flex: 1,
              },
            ],
            margin: 'md',
          },
        ]),
        paddingAll: 'lg',
        spacing: 'sm',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ดูรายละเอียด',
              uri: `${appUrl}/reports/low-stock`,
            },
            style: 'primary',
            color: '#3b82f6',
          },
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'สร้าง PR',
              uri: `${appUrl}/pr/new`,
            },
            style: 'secondary',
            margin: 'sm',
          },
        ],
        paddingAll: 'lg',
      },
    }
  },

  /**
   * PR Approval Request Card
   */
  prApprovalRequest(data: { prNumber: string; requester: string; itemCount: number; totalAmount?: number }, appUrl: string): FlexBubble {
    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📋 ใบขอซื้อรออนุมัติ',
            weight: 'bold',
            size: 'lg',
            color: '#3b82f6',
          },
          {
            type: 'text',
            text: data.prNumber,
            size: 'md',
            color: '#333333',
            weight: 'bold',
          },
        ],
        backgroundColor: '#dbeafe',
        paddingAll: 'lg',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ผู้ขอ:', size: 'sm', color: '#888888', flex: 1 },
              { type: 'text', text: data.requester, size: 'sm', weight: 'bold', flex: 2 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'จำนวน:', size: 'sm', color: '#888888', flex: 1 },
              { type: 'text', text: `${data.itemCount} รายการ`, size: 'sm', weight: 'bold', flex: 2 },
            ],
            margin: 'md',
          },
          ...(data.totalAmount ? [{
            type: 'box' as const,
            layout: 'horizontal' as const,
            contents: [
              { type: 'text' as const, text: 'มูลค่า:', size: 'sm' as const, color: '#888888', flex: 1 },
              { type: 'text' as const, text: `฿${data.totalAmount.toLocaleString()}`, size: 'sm' as const, weight: 'bold' as const, flex: 2 },
            ],
            margin: 'md',
          }] : []),
        ],
        paddingAll: 'lg',
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ดูรายละเอียด',
              uri: `${appUrl}/pr`,
            },
            style: 'primary',
            color: '#3b82f6',
            height: 'sm',
          },
        ],
        paddingAll: 'lg',
      },
    }
  },

  /**
   * PO Status Update Card
   */
  poStatusUpdate(data: { poNumber: string; supplier: string; status: string; eta?: string }, appUrl: string): FlexBubble {
    const statusColors: Record<string, string> = {
      APPROVED: '#22c55e',
      SENT: '#3b82f6',
      PARTIAL: '#f59e0b',
      RECEIVED: '#22c55e',
      OVERDUE: '#dc2626',
    }

    const statusLabels: Record<string, string> = {
      APPROVED: 'อนุมัติแล้ว',
      SENT: 'ส่งแล้ว',
      PARTIAL: 'รับบางส่วน',
      RECEIVED: 'รับครบแล้ว',
      OVERDUE: 'เกินกำหนด',
    }

    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '📦 อัพเดท PO',
            weight: 'bold',
            size: 'lg',
            color: statusColors[data.status] || '#333333',
          },
          {
            type: 'text',
            text: data.poNumber,
            size: 'md',
            weight: 'bold',
          },
        ],
        backgroundColor: '#f0fdf4',
        paddingAll: 'lg',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'Supplier:', size: 'sm', color: '#888888', flex: 1 },
              { type: 'text', text: data.supplier, size: 'sm', weight: 'bold', flex: 2, wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'สถานะ:', size: 'sm', color: '#888888', flex: 1 },
              { 
                type: 'text', 
                text: statusLabels[data.status] || data.status, 
                size: 'sm', 
                weight: 'bold', 
                color: statusColors[data.status] || '#333333',
                flex: 2,
              },
            ],
            margin: 'md',
          },
          ...(data.eta ? [{
            type: 'box' as const,
            layout: 'horizontal' as const,
            contents: [
              { type: 'text' as const, text: 'ETA:', size: 'sm' as const, color: '#888888', flex: 1 },
              { type: 'text' as const, text: data.eta, size: 'sm' as const, weight: 'bold' as const, flex: 2 },
            ],
            margin: 'md',
          }] : []),
        ],
        paddingAll: 'lg',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ดูรายละเอียด',
              uri: `${appUrl}/po`,
            },
            style: 'primary',
            color: '#3b82f6',
          },
        ],
        paddingAll: 'lg',
      },
    }
  },

  /**
   * Movement Posted Card
   */
  movementPosted(data: { docNumber: string; type: string; itemCount: number; createdBy: string }, appUrl: string): FlexBubble {
    const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
      RECEIVE: { icon: '📥', label: 'รับเข้า', color: '#22c55e' },
      ISSUE: { icon: '📤', label: 'เบิกออก', color: '#dc2626' },
      TRANSFER: { icon: '🔄', label: 'โอนย้าย', color: '#3b82f6' },
      ADJUST: { icon: '📝', label: 'ปรับยอด', color: '#f59e0b' },
      RETURN: { icon: '↩️', label: 'คืนของ', color: '#8b5cf6' },
    }

    const config = typeConfig[data.type] || { icon: '📦', label: data.type, color: '#333333' }

    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${config.icon} ${config.label}`,
            weight: 'bold',
            size: 'lg',
            color: config.color,
          },
          {
            type: 'text',
            text: data.docNumber,
            size: 'md',
            weight: 'bold',
          },
        ],
        backgroundColor: '#f8fafc',
        paddingAll: 'lg',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'รายการ:', size: 'sm', color: '#888888', flex: 1 },
              { type: 'text', text: `${data.itemCount} รายการ`, size: 'sm', weight: 'bold', flex: 2 },
            ],
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: 'โดย:', size: 'sm', color: '#888888', flex: 1 },
              { type: 'text', text: data.createdBy, size: 'sm', weight: 'bold', flex: 2 },
            ],
            margin: 'md',
          },
        ],
        paddingAll: 'lg',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ดูรายละเอียด',
              uri: `${appUrl}/movements`,
            },
            style: 'primary',
            color: '#3b82f6',
          },
        ],
        paddingAll: 'lg',
      },
    }
  },

  /**
   * Expiring Stock Alert Card
   */
  expiringStockAlert(items: { name: string; lotNumber: string; expiryDate: string; daysLeft: number }[], appUrl: string): FlexBubble {
    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '⏰ สินค้าใกล้หมดอายุ',
            weight: 'bold',
            size: 'lg',
            color: '#dc2626',
          },
          {
            type: 'text',
            text: `${items.length} รายการ`,
            size: 'sm',
            color: '#666666',
          },
        ],
        backgroundColor: '#fef2f2',
        paddingAll: 'lg',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: items.slice(0, 5).flatMap((item, index) => [
          ...(index > 0 ? [{ type: 'separator' as const, margin: 'md' }] : []),
          {
            type: 'box' as const,
            layout: 'vertical' as const,
            contents: [
              {
                type: 'text' as const,
                text: item.name,
                size: 'sm',
                weight: 'bold' as const,
                wrap: true,
              },
              {
                type: 'box' as const,
                layout: 'horizontal' as const,
                contents: [
                  {
                    type: 'text' as const,
                    text: `Lot: ${item.lotNumber}`,
                    size: 'xs',
                    color: '#888888',
                    flex: 2,
                  },
                  {
                    type: 'text' as const,
                    text: item.daysLeft <= 0 ? 'หมดอายุแล้ว!' : `อีก ${item.daysLeft} วัน`,
                    size: 'xs',
                    color: item.daysLeft <= 0 ? '#dc2626' : item.daysLeft <= 7 ? '#f59e0b' : '#888888',
                    weight: 'bold' as const,
                    align: 'end' as const,
                    flex: 1,
                  },
                ],
                margin: 'sm',
              },
            ],
            margin: 'md',
          },
        ]),
        paddingAll: 'lg',
        spacing: 'sm',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'ดูรายละเอียด',
              uri: `${appUrl}/reports/expiring`,
            },
            style: 'primary',
            color: '#dc2626',
          },
        ],
        paddingAll: 'lg',
      },
    }
  },

  /**
   * Custom Text Card
   */
  customCard(title: string, message: string, buttonLabel?: string, buttonUrl?: string, color?: string): FlexBubble {
    const themeColor = color || '#3b82f6'

    return {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: title,
            weight: 'bold',
            size: 'lg',
            color: themeColor,
          },
        ],
        backgroundColor: '#f8fafc',
        paddingAll: 'lg',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: message,
            size: 'sm',
            wrap: true,
            color: '#333333',
          },
        ],
        paddingAll: 'lg',
      },
      ...(buttonLabel && buttonUrl ? {
        footer: {
          type: 'box' as const,
          layout: 'vertical' as const,
          contents: [
            {
              type: 'button' as const,
              action: {
                type: 'uri' as const,
                label: buttonLabel,
                uri: buttonUrl,
              },
              style: 'primary' as const,
              color: themeColor,
            },
          ],
          paddingAll: 'lg',
        },
      } : {}),
    }
  },
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get LINE client from environment or settings
 */
export function getLineClient(): LineClient | null {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN

  if (!token) {
    console.warn('LINE_CHANNEL_ACCESS_TOKEN not configured')
    return null
  }

  return new LineClient({
    channelAccessToken: token,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
  })
}

/**
 * Create LINE client from custom config
 */
export function createLineClient(config: LineConfig): LineClient {
  return new LineClient(config)
}

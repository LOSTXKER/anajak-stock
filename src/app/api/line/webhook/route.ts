import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getLineSettings } from '@/actions/line-notifications'

// LINE Webhook Event Types
interface LineEvent {
  type: string
  replyToken?: string
  source: {
    type: 'user' | 'group' | 'room'
    userId?: string
    groupId?: string
    roomId?: string
  }
  timestamp: number
  message?: {
    type: string
    id: string
    text?: string
  }
}

interface LineWebhookBody {
  destination: string
  events: LineEvent[]
}

// Verify LINE signature
function verifySignature(body: string, signature: string, channelSecret: string): boolean {
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64')
  return hash === signature
}

// Reply to LINE
async function replyMessage(replyToken: string, messages: object[], accessToken: string) {
  console.log('replyMessage called with token length:', accessToken?.length)
  
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  })

  console.log('LINE API response status:', response.status)
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    console.error('LINE reply error:', response.status, JSON.stringify(error))
  } else {
    console.log('LINE reply success!')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-line-signature')

    console.log('=== LINE WEBHOOK RECEIVED ===')
    console.log('Body:', body.substring(0, 500))

    // Parse webhook body first
    let webhookBody: LineWebhookBody
    try {
      webhookBody = JSON.parse(body)
    } catch (e) {
      console.log('LINE webhook: Invalid JSON', e)
      return NextResponse.json({ success: true })
    }

    console.log('Events count:', webhookBody.events?.length || 0)

    // If no events (verification request), return 200 immediately
    if (!webhookBody.events || webhookBody.events.length === 0) {
      console.log('LINE webhook: No events (verification request)')
      return NextResponse.json({ success: true })
    }

    // Log event details
    for (const evt of webhookBody.events) {
      console.log('Event type:', evt.type, 'Source:', evt.source?.type, 'Message:', evt.message?.text)
    }

    // Get settings - only needed when there are events to process
    const settingsResult = await getLineSettings()
    console.log('Settings result:', settingsResult.success)
    
    if (!settingsResult.success || !settingsResult.data) {
      console.log('LINE webhook: No settings configured', settingsResult.success ? 'no data' : 'failed')
      return NextResponse.json({ success: true })
    }

    const { channelAccessToken, channelSecret } = settingsResult.data
    console.log('Has access token:', !!channelAccessToken, 'Token length:', channelAccessToken?.length || 0)
    console.log('Has channel secret:', !!channelSecret)
    
    // If no access token, can't reply but still return 200
    if (!channelAccessToken) {
      console.log('LINE webhook: No access token configured')
      return NextResponse.json({ success: true })
    }

    // Use channel secret from settings, fallback to environment variable
    const secret = channelSecret || process.env.LINE_CHANNEL_SECRET

    // Verify signature if channel secret is set
    if (secret && signature) {
      const isValid = verifySignature(body, signature, secret)
      console.log('Signature verification:', isValid)
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    // Process events
    for (const event of webhookBody.events) {
      // Handle join event (when bot is added to a group)
      if (event.type === 'join') {
        if (event.source.type === 'group' && event.source.groupId && event.replyToken) {
          // Reply with group ID
          await replyMessage(
            event.replyToken,
            [
              {
                type: 'flex',
                altText: 'Group ID ของกลุ่มนี้',
                contents: {
                  type: 'bubble',
                  header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                      {
                        type: 'text',
                        text: '🎉 สวัสดี!',
                        weight: 'bold',
                        size: 'lg',
                        color: '#22c55e',
                      },
                      {
                        type: 'text',
                        text: 'Bot ได้เข้าร่วมกลุ่มแล้ว',
                        size: 'sm',
                        color: '#666666',
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
                        type: 'text',
                        text: 'Group ID:',
                        size: 'sm',
                        color: '#888888',
                      },
                      {
                        type: 'text',
                        text: event.source.groupId,
                        size: 'xs',
                        wrap: true,
                        color: '#333333',
                        margin: 'sm',
                      },
                      {
                        type: 'separator',
                        margin: 'lg',
                      },
                      {
                        type: 'text',
                        text: '📋 คัดลอก ID นี้ไปใส่ใน "ผู้รับการแจ้งเตือน" ที่หน้าตั้งค่าเพื่อให้กลุ่มนี้รับการแจ้งเตือน',
                        size: 'xs',
                        wrap: true,
                        color: '#666666',
                        margin: 'lg',
                      },
                    ],
                    paddingAll: 'lg',
                  },
                },
              },
            ],
            channelAccessToken
          )
        } else if (event.source.type === 'room' && event.source.roomId && event.replyToken) {
          // Reply with room ID
          await replyMessage(
            event.replyToken,
            [
              {
                type: 'text',
                text: `🎉 สวัสดี!\n\nRoom ID: ${event.source.roomId}\n\nคัดลอก ID นี้ไปใส่ใน "ผู้รับการแจ้งเตือน" ที่หน้าตั้งค่า`,
              },
            ],
            channelAccessToken
          )
        }
      }

      // Handle follow event (when user adds bot as friend)
      if (event.type === 'follow' && event.source.userId && event.replyToken) {
        await replyMessage(
          event.replyToken,
          [
            {
              type: 'flex',
              altText: 'ยินดีต้อนรับ!',
              contents: {
                type: 'bubble',
                header: {
                  type: 'box',
                  layout: 'vertical',
                  contents: [
                    {
                      type: 'text',
                      text: '👋 ยินดีต้อนรับ!',
                      weight: 'bold',
                      size: 'lg',
                      color: '#3b82f6',
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
                      type: 'text',
                      text: 'ขอบคุณที่เพิ่ม Bot เป็นเพื่อน',
                      size: 'sm',
                      wrap: true,
                    },
                    {
                      type: 'separator',
                      margin: 'lg',
                    },
                    {
                      type: 'text',
                      text: 'User ID ของคุณ:',
                      size: 'sm',
                      color: '#888888',
                      margin: 'lg',
                    },
                    {
                      type: 'text',
                      text: event.source.userId,
                      size: 'xs',
                      wrap: true,
                      color: '#333333',
                      margin: 'sm',
                    },
                    {
                      type: 'text',
                      text: '📋 คัดลอก ID นี้ไปใส่ใน "ผู้รับการแจ้งเตือน" ที่หน้าตั้งค่าเพื่อรับการแจ้งเตือน',
                      size: 'xs',
                      wrap: true,
                      color: '#666666',
                      margin: 'lg',
                    },
                  ],
                  paddingAll: 'lg',
                },
              },
            },
          ],
          channelAccessToken
        )
      }

      // Handle message event - respond to "id" command
      if (event.type === 'message' && event.message?.type === 'text' && event.replyToken) {
        const text = event.message.text?.toLowerCase().trim()
        console.log('Message received:', text)
        
        if (text === 'id' || text === 'myid' || text === 'groupid') {
          console.log('ID command detected!')
          let responseText = ''
          
          if (event.source.type === 'group' && event.source.groupId) {
            responseText = `📋 Group ID:\n${event.source.groupId}`
            if (event.source.userId) {
              responseText += `\n\n👤 User ID:\n${event.source.userId}`
            }
          } else if (event.source.type === 'room' && event.source.roomId) {
            responseText = `📋 Room ID:\n${event.source.roomId}`
            if (event.source.userId) {
              responseText += `\n\n👤 User ID:\n${event.source.userId}`
            }
          } else if (event.source.userId) {
            responseText = `👤 User ID:\n${event.source.userId}`
          }

          console.log('Response text:', responseText)

          if (responseText) {
            console.log('Sending reply...')
            await replyMessage(
              event.replyToken,
              [{ type: 'text', text: responseText }],
              channelAccessToken
            )
            console.log('Reply sent!')
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('LINE webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// LINE requires webhook URL to respond to GET request for verification
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

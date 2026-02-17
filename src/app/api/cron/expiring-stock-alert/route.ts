import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { getExpiringItems } from '@/actions/line-notifications'
import { FlexTemplates } from '@/lib/integrations/line'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const items = await getExpiringItems()

    if (items.length === 0) {
      return NextResponse.json({ success: true, message: 'No expiring items' })
    }

    // Get all eligible users
    const users = await prisma.user.findMany({
      where: { active: true, deletedAt: null, role: { in: ['ADMIN', 'APPROVER', 'INVENTORY'] } },
      select: { id: true },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const lineTemplate = {
      altText: `⏰ สินค้าใกล้หมดอายุ ${items.length} รายการ`,
      flex: FlexTemplates.expiringStockAlert(items, appUrl),
    }

    const result = await dispatchNotification({
      type: 'expiring',
      webType: 'expiring_soon',
      title: `สินค้าใกล้หมดอายุ ${items.length} รายการ`,
      message: `มีสินค้าที่จะหมดอายุภายใน 30 วัน ${items.length} รายการ`,
      url: '/reports/expiring',
      lineTemplate,
      targetUserIds: users.map((u) => u.id),
    })

    return NextResponse.json({
      success: true,
      itemCount: items.length,
      deliveries: result.deliveries.length,
      errors: result.errors.length,
    })
  } catch (error) {
    console.error('Cron expiring stock alert error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send expiring alert' },
      { status: 500 }
    )
  }
}

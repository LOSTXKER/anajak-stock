import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { getLowStockItems } from '@/actions/line-notifications'
import { NOTIFICATION_TEMPLATES } from '@/lib/notification-templates'
import { lowStockAlertEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const lowStockItems = await getLowStockItems()

    if (lowStockItems.length === 0) {
      return NextResponse.json({ success: true, message: 'No low stock items' })
    }

    // Get all eligible users (admins, approvers, inventory)
    const users = await prisma.user.findMany({
      where: { active: true, deletedAt: null, role: { in: ['ADMIN', 'APPROVER', 'INVENTORY'] } },
      select: { id: true },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const lineTemplate = NOTIFICATION_TEMPLATES.lowStock({ lowStockItems }, appUrl)

    const emailHtml = lowStockAlertEmail(
      lowStockItems.map((item) => ({
        name: item.name,
        sku: item.sku,
        qty: item.qty,
        reorderPoint: item.rop,
      }))
    )

    const result = await dispatchNotification({
      type: 'lowStock',
      webType: 'low_stock',
      title: `สินค้าใกล้หมด ${lowStockItems.length} รายการ`,
      message: `มีสินค้าที่ต่ำกว่า Reorder Point ${lowStockItems.length} รายการ`,
      url: '/reports/low-stock',
      lineTemplate,
      emailSubject: `[แจ้งเตือน] สินค้าใกล้หมด ${lowStockItems.length} รายการ`,
      emailHtml,
      targetUserIds: users.map((u) => u.id),
    })

    return NextResponse.json({
      success: true,
      itemCount: lowStockItems.length,
      deliveries: result.deliveries.length,
      errors: result.errors.length,
    })
  } catch (error) {
    console.error('Cron low stock alert error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send alert' },
      { status: 500 }
    )
  }
}

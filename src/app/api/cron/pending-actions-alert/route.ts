import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dispatchNotification } from '@/lib/notification-dispatcher'
import { getPendingActionsForCron } from '@/actions/pending-actions'
import { FlexTemplates } from '@/lib/integrations/line'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const pendingResult = await getPendingActionsForCron()

    if (!pendingResult.success) {
      return NextResponse.json(
        { success: false, error: pendingResult.error },
        { status: 500 }
      )
    }

    const pending = pendingResult.data

    if (!pending || pending.total === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending actions',
        pending: {
          total: 0,
          grnDraft: 0,
          poApproved: 0,
          poSent: 0,
          prSubmitted: 0,
          movementApproved: 0,
          stockTakeCompleted: 0,
        },
      })
    }

    // Build summary for notification
    const summaryLines: string[] = []
    if (pending.grnDraft > 0) summaryLines.push(`GRN รอบันทึก: ${pending.grnDraft}`)
    if (pending.poApproved > 0) summaryLines.push(`PO รอส่ง Supplier: ${pending.poApproved}`)
    if (pending.poSent > 0) summaryLines.push(`PO เลย ETA: ${pending.poSent}`)
    if (pending.prSubmitted > 0) summaryLines.push(`PR รออนุมัติ: ${pending.prSubmitted}`)
    if (pending.movementApproved > 0) summaryLines.push(`Movement รอบันทึก: ${pending.movementApproved}`)
    if (pending.stockTakeCompleted > 0) summaryLines.push(`ตรวจนับรออนุมัติ: ${pending.stockTakeCompleted}`)

    // Get all eligible users (admins, approvers, inventory)
    const users = await prisma.user.findMany({
      where: { active: true, deletedAt: null, role: { in: ['ADMIN', 'APPROVER', 'INVENTORY'] } },
      select: { id: true },
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const lineTemplate = {
      altText: `⚡ งานค้าง ${pending.total} รายการ`,
      flex: FlexTemplates.customCard(
        `⚡ งานค้าง ${pending.total} รายการ`,
        summaryLines.join('\n'),
        'ดูรายละเอียด',
        `${appUrl}/dashboard`,
      ),
    }

    const result = await dispatchNotification({
      type: 'poPending',
      webType: 'system',
      title: '⚡ งานค้างที่ต้องดำเนินการ',
      message: `มีงานค้าง ${pending.total} รายการที่ต้องดำเนินการ`,
      url: '/dashboard',
      lineTemplate,
      targetUserIds: users.map((u) => u.id),
    })

    return NextResponse.json({
      success: true,
      pending: {
        total: pending.total,
        grnDraft: pending.grnDraft,
        poApproved: pending.poApproved,
        poSent: pending.poSent,
        prSubmitted: pending.prSubmitted,
        movementApproved: pending.movementApproved,
        stockTakeCompleted: pending.stockTakeCompleted,
      },
      deliveries: result.deliveries.length,
      errors: result.errors.length,
    })
  } catch (error) {
    console.error('Cron pending actions alert error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send alert' },
      { status: 500 }
    )
  }
}

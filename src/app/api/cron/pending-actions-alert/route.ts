import { NextRequest, NextResponse } from 'next/server'
import { sendLinePendingActionsAlert } from '@/actions/line-notifications'
import { getPendingActionsForCron } from '@/actions/pending-actions'
import { prisma } from '@/lib/prisma'

// This endpoint can be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// to send daily pending actions alerts via LINE
// Recommended: Run at 8:00 AM every weekday

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get pending actions summary
    const pendingResult = await getPendingActionsForCron()
    
    if (!pendingResult.success) {
      return NextResponse.json(
        { success: false, error: pendingResult.error },
        { status: 500 }
      )
    }

    const pending = pendingResult.data
    
    // Only send alert if there are pending actions
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

    // Send LINE notification
    const lineResult = await sendLinePendingActionsAlert()

    // Create in-app notification for all users with pending actions
    if (pending.total > 0) {
      await prisma.notification.create({
        data: {
          type: 'system',
          title: '⚡ งานค้างที่ต้องดำเนินการ',
          message: `มีงานค้าง ${pending.total} รายการที่ต้องดำเนินการ`,
          url: '/dashboard',
          // userId null = broadcast to all users
        },
      })
    }

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
      line: lineResult.success 
        ? { sent: lineResult.data?.sent, count: lineResult.data?.count }
        : { error: lineResult.error },
    })
  } catch (error) {
    console.error('Cron pending actions alert error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send alert' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { sendLowStockAlert } from '@/actions/notifications'
import { sendLineLowStockAlert } from '@/actions/line-notifications'

// This endpoint can be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// to send daily low stock alerts via Email and LINE

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Send alerts via both Email and LINE in parallel
    const [emailResult, lineResult] = await Promise.allSettled([
      sendLowStockAlert(),
      sendLineLowStockAlert(),
    ])

    return NextResponse.json({
      success: true,
      email: emailResult.status === 'fulfilled' ? emailResult.value : { error: 'Failed' },
      line: lineResult.status === 'fulfilled' ? lineResult.value : { error: 'Failed' },
    })
  } catch (error) {
    console.error('Cron low stock alert error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send alert' },
      { status: 500 }
    )
  }
}

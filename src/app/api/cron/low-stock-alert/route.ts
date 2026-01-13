import { NextRequest, NextResponse } from 'next/server'
import { sendLowStockAlert } from '@/actions/notifications'

// This endpoint can be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// to send daily low stock alerts

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendLowStockAlert()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Cron low stock alert error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send alert' },
      { status: 500 }
    )
  }
}

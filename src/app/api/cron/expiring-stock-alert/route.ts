import { NextRequest, NextResponse } from 'next/server'
import { sendLineExpiringAlert } from '@/actions/line-notifications'

// This endpoint can be called by a cron job (e.g., Vercel Cron, GitHub Actions)
// to send alerts for products expiring within 30 days via LINE

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await sendLineExpiringAlert()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Cron expiring stock alert error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send expiring alert' },
      { status: 500 }
    )
  }
}

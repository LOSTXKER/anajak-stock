import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getLotsByProduct } from '@/actions/lots'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')
  const variantId = searchParams.get('variantId')

  if (!productId) {
    return NextResponse.json(
      { success: false, error: 'Missing productId' },
      { status: 400 }
    )
  }

  const result = await getLotsByProduct(productId, variantId || undefined)
  
  return NextResponse.json(result)
}

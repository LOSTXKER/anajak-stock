import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    })

    if (!attachment) {
      return NextResponse.json({ success: false, error: 'ไม่พบไฟล์แนบ' }, { status: 404 })
    }

    // Delete from database
    // Note: File in Supabase Storage will remain (can be cleaned up later or by bucket policy)
    await prisma.attachment.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete attachment error:', error)
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถลบไฟล์ได้' },
      { status: 500 }
    )
  }
}

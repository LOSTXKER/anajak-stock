import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { uploadFile, generatePath } from '@/lib/supabase/storage'

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const refType = formData.get('refType') as string | null
    const refId = formData.get('refId') as string | null

    if (!file || !refType || !refId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'ไฟล์มีขนาดใหญ่เกิน 10MB' },
        { status: 400 }
      )
    }

    // Generate storage path
    const path = generatePath(refType, refId, file.name)

    // Upload to Supabase Storage
    const uploadResult = await uploadFile(file, path)
    if ('error' in uploadResult) {
      return NextResponse.json({ success: false, error: uploadResult.error }, { status: 500 })
    }

    // Create attachment record in database
    const attachment = await prisma.attachment.create({
      data: {
        refType: refType.toUpperCase(),
        refId: refId,
        fileName: file.name,
        fileUrl: uploadResult.url,
        fileSize: file.size,
        mimeType: file.type,
        // Link to the appropriate entity
        ...(refType === 'stockMovement' && { movementId: refId }),
        ...(refType === 'pr' && { prId: refId }),
        ...(refType === 'po' && { poId: refId }),
        ...(refType === 'grn' && { grnId: refId }),
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: attachment.id,
        filename: attachment.fileName,
        url: attachment.fileUrl,
        size: attachment.fileSize,
      },
    })
  } catch (error) {
    console.error('Upload attachment error:', error)
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถอัพโหลดไฟล์ได้' },
      { status: 500 }
    )
  }
}

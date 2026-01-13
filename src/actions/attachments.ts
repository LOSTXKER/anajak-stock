'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { uploadFile, deleteFile, generatePath } from '@/lib/supabase/storage'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/types'

interface AttachmentInput {
  refType: 'product' | 'stockMovement' | 'pr' | 'po' | 'grn'
  refId: string
  file: File
}

interface AttachmentResult {
  id: string
  fileName: string
  fileUrl: string
}

export async function createAttachment(
  input: AttachmentInput
): Promise<ActionResult<AttachmentResult>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'กรุณาเข้าสู่ระบบ' }
  }

  const { refType, refId, file } = input

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: 'ไฟล์มีขนาดใหญ่เกิน 10MB' }
  }

  // Generate storage path
  const path = generatePath(refType, refId, file.name)

  // Upload to Supabase Storage
  const uploadResult = await uploadFile(file, path)
  if ('error' in uploadResult) {
    return { success: false, error: uploadResult.error }
  }

  try {
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

    revalidatePath(`/${refType}s/${refId}`)

    return {
      success: true,
      data: {
        id: attachment.id,
        fileName: attachment.fileName,
        fileUrl: attachment.fileUrl,
      },
    }
  } catch (error) {
    // Cleanup uploaded file on database error
    await deleteFile(path)
    console.error('Create attachment error:', error)
    return { success: false, error: 'ไม่สามารถบันทึกไฟล์แนบได้' }
  }
}

export async function removeAttachment(id: string): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'กรุณาเข้าสู่ระบบ' }
  }

  try {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    })

    if (!attachment) {
      return { success: false, error: 'ไม่พบไฟล์แนบ' }
    }

    // Delete from database
    await prisma.attachment.delete({
      where: { id },
    })

    return { success: true, data: undefined }
  } catch (error) {
    console.error('Delete attachment error:', error)
    return { success: false, error: 'ไม่สามารถลบไฟล์แนบได้' }
  }
}

export async function getAttachments(
  refType: 'product' | 'stockMovement' | 'pr' | 'po' | 'grn',
  refId: string
) {
  const whereClause = {
    refType: refType.toUpperCase(),
    refId: refId,
  }

  return prisma.attachment.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
  })
}

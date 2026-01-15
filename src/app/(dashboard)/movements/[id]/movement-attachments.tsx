'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUpload } from '@/components/file-upload'
import { Paperclip } from 'lucide-react'

interface Attachment {
  id: string
  filename: string
  url: string
  size?: number
  mimeType?: string
}

interface MovementAttachmentsProps {
  movementId: string
  readOnly?: boolean
}

export function MovementAttachments({ movementId, readOnly = false }: MovementAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadAttachments() {
      try {
        const response = await fetch(`/api/attachments?refType=stockMovement&refId=${movementId}`)
        if (response.ok) {
          const data = await response.json()
          setAttachments(data.map((a: { id: string; fileName: string; fileUrl: string; fileSize?: number; mimeType?: string }) => ({
            id: a.id,
            filename: a.fileName,
            url: a.fileUrl,
            size: a.fileSize,
            mimeType: a.mimeType,
          })))
        }
      } catch (error) {
        console.error('Failed to load attachments:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadAttachments()
  }, [movementId])

  function handleUpload(attachment: Attachment) {
    setAttachments((prev) => [attachment, ...prev])
  }

  function handleDelete(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-[var(--accent-primary)]" />
            ไฟล์แนบ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-primary)]" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[var(--accent-primary)]" />
          ไฟล์แนบ
          {attachments.length > 0 && (
            <span className="text-sm font-normal text-[var(--text-muted)]">
              ({attachments.length} ไฟล์)
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <FileUpload
          refType="stockMovement"
          refId={movementId}
          attachments={attachments}
          onUpload={handleUpload}
          onDelete={handleDelete}
          readOnly={readOnly}
        />
      </CardContent>
    </Card>
  )
}

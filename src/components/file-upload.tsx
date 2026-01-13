'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Attachment {
  id: string
  filename: string
  url: string
  size?: number
  mimeType?: string
}

interface FileUploadProps {
  refType: 'product' | 'stockMovement' | 'pr' | 'po' | 'grn'
  refId: string
  attachments: Attachment[]
  onUpload?: (attachment: Attachment) => void
  onDelete?: (id: string) => void
  readOnly?: boolean
}

export function FileUpload({
  refType,
  refId,
  attachments,
  onUpload,
  onDelete,
  readOnly = false,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('refType', refType)
        formData.append('refId', refId)

        const response = await fetch('/api/attachments', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (result.success) {
          toast.success(`อัพโหลด ${file.name} สำเร็จ`)
          onUpload?.(result.data)
        } else {
          toast.error(result.error || 'อัพโหลดไม่สำเร็จ')
        }
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการอัพโหลด')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  async function handleDelete(id: string) {
    try {
      const response = await fetch(`/api/attachments/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        toast.success('ลบไฟล์สำเร็จ')
        onDelete?.(id)
      } else {
        toast.error(result.error || 'ลบไม่สำเร็จ')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการลบ')
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!readOnly && (
        <Card
          className={`bg-slate-800/50 border-2 border-dashed transition-colors cursor-pointer ${
            isDragging
              ? 'border-[var(--accent-primary)] bg-[var(--accent-light)]'
              : 'border-slate-700 hover:border-slate-600'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-8">
            {isUploading ? (
              <>
                <Loader2 className="w-10 h-10 text-[var(--accent-primary)] animate-spin mb-2" />
                <p className="text-sm text-slate-400">กำลังอัพโหลด...</p>
              </>
            ) : (
              <>
                <Upload className="w-10 h-10 text-slate-500 mb-2" />
                <p className="text-sm text-slate-400">
                  ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
                </p>
                <p className="text-xs text-slate-500 mt-1">ขนาดไม่เกิน 10MB</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <Card key={attachment.id} className="bg-slate-800/50 border-slate-700">
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-[var(--accent-primary)]" />
                  <div>
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-white hover:text-[var(--accent-primary)]"
                    >
                      {attachment.filename}
                    </a>
                    {attachment.size && (
                      <p className="text-xs text-slate-500">
                        {formatFileSize(attachment.size)}
                      </p>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-red-400"
                    onClick={() => handleDelete(attachment.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {attachments.length === 0 && readOnly && (
        <p className="text-sm text-slate-500 text-center py-4">ไม่มีไฟล์แนบ</p>
      )}
    </div>
  )
}

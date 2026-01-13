import { createClient } from './server'

const BUCKET_NAME = 'attachments'

export async function uploadFile(file: File, path: string): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Upload error:', error)
    return { error: error.message }
  }

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path)

  return { url: urlData.publicUrl }
}

export async function deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path])

  if (error) {
    console.error('Delete error:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function getSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn)

  if (error) {
    console.error('Signed URL error:', error)
    return { error: error.message }
  }

  return { url: data.signedUrl }
}

export function generatePath(refType: string, refId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${refType}/${refId}/${timestamp}_${sanitizedFilename}`
}

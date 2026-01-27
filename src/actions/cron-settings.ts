'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/types'
import { revalidatePath } from 'next/cache'

export interface CronJobConfig {
  id: string
  name: string
  description: string
  endpoint: string
  enabled: boolean
  hour: number // 0-23 (UTC)
  minute: number // 0-59
  days: number[] // 0=Sun, 1=Mon, ..., 6=Sat
  lastRun?: Date
  lastStatus?: 'success' | 'error'
}

export interface CronSettings {
  pendingActionsAlert: CronJobConfig
  lowStockAlert: CronJobConfig
  expiringStockAlert: CronJobConfig
}

const DEFAULT_CRON_SETTINGS: CronSettings = {
  pendingActionsAlert: {
    id: 'pending-actions',
    name: 'แจ้งเตือนงานค้าง',
    description: 'แจ้งเตือน GRN รอบันทึก, PO รอส่ง, PR รออนุมัติ ฯลฯ',
    endpoint: '/api/cron/pending-actions-alert',
    enabled: true,
    hour: 1, // 08:00 Thai time (UTC+7)
    minute: 0,
    days: [1, 2, 3, 4, 5], // Mon-Fri
  },
  lowStockAlert: {
    id: 'low-stock',
    name: 'แจ้งเตือนสินค้าใกล้หมด',
    description: 'แจ้งเตือนเมื่อสินค้าต่ำกว่า Reorder Point',
    endpoint: '/api/cron/low-stock-alert',
    enabled: true,
    hour: 2, // 09:00 Thai time
    minute: 0,
    days: [1, 2, 3, 4, 5], // Mon-Fri
  },
  expiringStockAlert: {
    id: 'expiring-stock',
    name: 'แจ้งเตือนสินค้าใกล้หมดอายุ',
    description: 'แจ้งเตือนสินค้าที่จะหมดอายุภายใน 30 วัน',
    endpoint: '/api/cron/expiring-stock-alert',
    enabled: true,
    hour: 3, // 10:00 Thai time
    minute: 0,
    days: [1], // Monday only
  },
}

export async function getCronSettings(): Promise<ActionResult<CronSettings>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'cron_settings' },
    })

    if (!setting) {
      return { success: true, data: DEFAULT_CRON_SETTINGS }
    }

    const data = JSON.parse(setting.value) as Partial<CronSettings>
    return {
      success: true,
      data: {
        pendingActionsAlert: { ...DEFAULT_CRON_SETTINGS.pendingActionsAlert, ...data.pendingActionsAlert },
        lowStockAlert: { ...DEFAULT_CRON_SETTINGS.lowStockAlert, ...data.lowStockAlert },
        expiringStockAlert: { ...DEFAULT_CRON_SETTINGS.expiringStockAlert, ...data.expiringStockAlert },
      },
    }
  } catch (error) {
    console.error('Error getting cron settings:', error)
    return { success: false, error: 'ไม่สามารถโหลดการตั้งค่าได้' }
  }
}

export async function updateCronSettings(settings: CronSettings): Promise<ActionResult<void>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    await prisma.setting.upsert({
      where: { key: 'cron_settings' },
      update: { value: JSON.stringify(settings) },
      create: { key: 'cron_settings', value: JSON.stringify(settings) },
    })

    revalidatePath('/settings/notifications')
    return { success: true, data: undefined }
  } catch (error) {
    console.error('Error updating cron settings:', error)
    return { success: false, error: 'ไม่สามารถบันทึกการตั้งค่าได้' }
  }
}

export async function runCronJobManually(jobId: string): Promise<ActionResult<{ message: string }>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let endpoint = ''

    switch (jobId) {
      case 'pending-actions':
        endpoint = '/api/cron/pending-actions-alert'
        break
      case 'low-stock':
        endpoint = '/api/cron/low-stock-alert'
        break
      case 'expiring-stock':
        endpoint = '/api/cron/expiring-stock-alert'
        break
      default:
        return { success: false, error: 'ไม่พบ Cron Job นี้' }
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET || ''}`,
      },
    })

    const result = await response.json()

    // Update last run status
    const settingsResult = await getCronSettings()
    if (settingsResult.success && settingsResult.data) {
      const settings = settingsResult.data
      const jobKey = jobId === 'pending-actions' ? 'pendingActionsAlert' 
        : jobId === 'low-stock' ? 'lowStockAlert' 
        : 'expiringStockAlert'
      
      settings[jobKey].lastRun = new Date()
      settings[jobKey].lastStatus = result.success ? 'success' : 'error'
      
      await updateCronSettings(settings)
    }

    if (result.success) {
      return { success: true, data: { message: 'รันสำเร็จ' } }
    } else {
      return { success: false, error: result.error || 'รันไม่สำเร็จ' }
    }
  } catch (error) {
    console.error('Error running cron job:', error)
    return { success: false, error: 'เกิดข้อผิดพลาดในการรัน' }
  }
}


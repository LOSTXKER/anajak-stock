import { Resend } from 'resend'

const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@example.com'

// Check if email service is configured
export function isEmailConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY
  // Check if it's a valid key (not placeholder)
  return !!apiKey && apiKey !== 'your_resend_api_key' && apiKey.startsWith('re_')
}

// Get email configuration status for display
export function getEmailStatus(): { 
  configured: boolean
  fromEmail: string
  message: string 
} {
  const configured = isEmailConfigured()
  return {
    configured,
    fromEmail: FROM_EMAIL,
    message: configured 
      ? 'Email service พร้อมใช้งาน' 
      : 'กรุณาตั้งค่า RESEND_API_KEY ใน .env',
  }
}

// Lazy initialization to avoid build-time errors
function getResendClient() {
  if (!isEmailConfigured()) {
    return null
  }
  return new Resend(process.env.RESEND_API_KEY!)
}

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail(options: EmailOptions) {
  const resend = getResendClient()
  
  if (!resend) {
    // Graceful degradation - log warning but return success with skipped flag
    console.warn('[Email] RESEND_API_KEY not configured, email skipped:', {
      to: Array.isArray(options.to) ? options.to.length + ' recipients' : options.to,
      subject: options.subject,
    })
    return { 
      success: true, 
      skipped: true,
      message: 'Email service not configured - notification skipped' 
    }
  }

  try {
    console.log('[Email] Sending email:', {
      from: FROM_EMAIL,
      to: Array.isArray(options.to) ? options.to.length + ' recipients' : options.to,
      subject: options.subject,
    })
    
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
    })

    if (error) {
      console.error('[Email] Send error:', error)
      return { success: false, error: error.message }
    }

    console.log('[Email] Sent successfully:', data?.id)
    return { success: true, data }
  } catch (error) {
    console.error('[Email] Exception:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

// Email Templates

export function lowStockAlertEmail(items: { name: string; sku: string; qty: number; reorderPoint: number }[]) {
  const itemsHtml = items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.sku}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #ef4444; font-weight: bold;">${item.qty}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.reorderPoint}</td>
      </tr>
    `
    )
    .join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ แจ้งเตือนสินค้าใกล้หมด</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin-bottom: 20px;">มีสินค้าที่ต่ำกว่า Reorder Point จำนวน <strong>${items.length}</strong> รายการ:</p>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-weight: 600;">SKU</th>
                <th style="padding: 12px; text-align: left; font-weight: 600;">สินค้า</th>
                <th style="padding: 12px; text-align: center; font-weight: 600;">คงเหลือ</th>
                <th style="padding: 12px; text-align: center; font-weight: 600;">ROP</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div style="margin-top: 30px; padding: 20px; background: #fef3c7; border-radius: 8px;">
            <p style="margin: 0; color: #92400e;">💡 กรุณาตรวจสอบและสร้างใบขอซื้อ (PR) สำหรับสินค้าเหล่านี้</p>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>ส่งจากระบบ Inventory Management</p>
        </div>
      </body>
    </html>
  `
}

export function prApprovalRequestEmail(pr: { prNumber: string; requesterName: string; itemCount: number; url: string }) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📋 ใบขอซื้อรออนุมัติ</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>มีใบขอซื้อใหม่รอการอนุมัติ:</p>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>เลขที่:</strong> ${pr.prNumber}</p>
            <p style="margin: 0 0 10px 0;"><strong>ผู้ขอ:</strong> ${pr.requesterName}</p>
            <p style="margin: 0;"><strong>จำนวนรายการ:</strong> ${pr.itemCount} รายการ</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${pr.url}" style="display: inline-block; background: #8b5cf6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">ดูใบขอซื้อ</a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>ส่งจากระบบ Inventory Management</p>
        </div>
      </body>
    </html>
  `
}

export function poApprovedEmail(po: { poNumber: string; supplierName: string; total: number }) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✅ PO ได้รับการอนุมัติ</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p>ใบสั่งซื้อได้รับการอนุมัติแล้ว:</p>
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>เลขที่ PO:</strong> ${po.poNumber}</p>
            <p style="margin: 0 0 10px 0;"><strong>Supplier:</strong> ${po.supplierName}</p>
            <p style="margin: 0;"><strong>มูลค่ารวม:</strong> ฿${po.total.toLocaleString()}</p>
          </div>
          <p style="color: #6b7280;">สามารถดำเนินการส่ง PO ไปยัง Supplier ได้ทันที</p>
        </div>
        <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
          <p>ส่งจากระบบ Inventory Management</p>
        </div>
      </body>
    </html>
  `
}

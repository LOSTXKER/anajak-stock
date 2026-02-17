import { 
  FlexTemplates, 
  type FlexContainer,
} from '@/lib/integrations/line'

// ============================================
// Notification Data & Templates
// ============================================

export type NotificationData = {
  // PR
  prId?: string
  prNumber?: string
  requesterName?: string
  approverName?: string
  reason?: string
  // PO
  poId?: string
  poNumber?: string
  supplierName?: string
  status?: string
  eta?: string
  // Movement
  movementId?: string
  docNumber?: string
  type?: string
  itemCount?: number
  // Low Stock
  lowStockItems?: { name: string; sku: string; qty: number; rop: number }[]
}

type TemplateResult = { altText: string; flex: FlexContainer }

export const NOTIFICATION_TEMPLATES: Record<string, (data: NotificationData, appUrl: string) => TemplateResult | null> = {
  prPending: (data, appUrl) => ({
    altText: `📋 ใบขอซื้อรออนุมัติ: ${data.prNumber}`,
    flex: FlexTemplates.prApprovalRequest(
      { prNumber: data.prNumber || '', requester: data.requesterName || '', itemCount: 0, totalAmount: undefined },
      appUrl,
    ),
  }),
  prApproved: (data, appUrl) => ({
    altText: `✅ PR ${data.prNumber} อนุมัติแล้ว`,
    flex: FlexTemplates.customCard(
      `✅ PR ${data.prNumber} อนุมัติแล้ว`,
      `ใบขอซื้อ ${data.prNumber} ได้รับการอนุมัติโดย ${data.approverName}`,
      'ดูรายละเอียด',
      `${appUrl}/pr/${data.prId}`,
    ),
  }),
  prRejected: (data, appUrl) => ({
    altText: `❌ PR ${data.prNumber} ถูกปฏิเสธ`,
    flex: FlexTemplates.customCard(
      `❌ PR ${data.prNumber} ถูกปฏิเสธ`,
      data.reason
        ? `ใบขอซื้อถูกปฏิเสธโดย ${data.approverName}: ${data.reason}`
        : `ใบขอซื้อถูกปฏิเสธโดย ${data.approverName}`,
      'ดูรายละเอียด',
      `${appUrl}/pr/${data.prId}`,
    ),
  }),
  poPending: (data, appUrl) => ({
    altText: `📦 PO รออนุมัติ: ${data.poNumber}`,
    flex: FlexTemplates.customCard(
      `📦 PO ใหม่รออนุมัติ`,
      `ใบสั่งซื้อ ${data.poNumber} รออนุมัติ`,
      'ดูรายละเอียด',
      `${appUrl}/po/${data.poId}`,
    ),
  }),
  poApproved: (data, appUrl) => ({
    altText: `✅ PO ${data.poNumber} อนุมัติแล้ว`,
    flex: FlexTemplates.poStatusUpdate(
      { poNumber: data.poNumber || '', supplier: data.supplierName || '', status: 'อนุมัติแล้ว', eta: data.eta },
      appUrl,
    ),
  }),
  poRejected: (data, appUrl) => ({
    altText: `❌ PO ${data.poNumber} ไม่อนุมัติ`,
    flex: FlexTemplates.customCard(
      `❌ PO ${data.poNumber} ไม่อนุมัติ`,
      data.reason
        ? `ใบสั่งซื้อไม่ได้รับการอนุมัติ: ${data.reason}`
        : `ใบสั่งซื้อไม่ได้รับการอนุมัติ`,
      'ดูรายละเอียด',
      `${appUrl}/po/${data.poId}`,
    ),
  }),
  poSent: (data, appUrl) => ({
    altText: `📤 PO ${data.poNumber} ส่งแล้ว`,
    flex: FlexTemplates.poStatusUpdate(
      { poNumber: data.poNumber || '', supplier: data.supplierName || '', status: 'ส่งให้ Supplier แล้ว', eta: data.eta },
      appUrl,
    ),
  }),
  poCancelled: (data, appUrl) => ({
    altText: `🚫 PO ${data.poNumber} ยกเลิก`,
    flex: FlexTemplates.customCard(
      `🚫 PO ${data.poNumber} ยกเลิก`,
      `ใบสั่งซื้อ ${data.poNumber} ถูกยกเลิกแล้ว`,
      'ดูรายละเอียด',
      `${appUrl}/po/${data.poId}`,
    ),
  }),
  poReceived: (data, appUrl) => ({
    altText: `📦 PO ${data.poNumber} รับสินค้าแล้ว`,
    flex: FlexTemplates.poStatusUpdate(
      { poNumber: data.poNumber || '', supplier: data.supplierName || '', status: 'รับสินค้าแล้ว', eta: data.eta },
      appUrl,
    ),
  }),
  movementPending: (data, appUrl) => ({
    altText: `⏳ ${data.type}รอดำเนินการ: ${data.docNumber}`,
    flex: FlexTemplates.movementPending(
      { docNumber: data.docNumber || '', type: data.type || '', itemCount: data.itemCount || 0, submittedBy: data.requesterName || '', movementId: data.movementId || '' },
      appUrl,
    ),
  }),
  movementPosted: (data, appUrl) => ({
    altText: `📦 ${data.type}: ${data.docNumber}`,
    flex: FlexTemplates.movementPosted(
      { docNumber: data.docNumber || '', type: data.type || '', itemCount: data.itemCount || 0, createdBy: data.requesterName || '' },
      appUrl,
    ),
  }),
  lowStock: (data, appUrl) => {
    if (!data.lowStockItems || data.lowStockItems.length === 0) return null
    return {
      altText: `⚠️ สินค้าใกล้หมด ${data.lowStockItems.length} รายการ`,
      flex: FlexTemplates.lowStockAlert(data.lowStockItems, appUrl),
    }
  },
}

// Centralized status configuration with action-oriented labels
// These labels clearly indicate what action is needed next

import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Send, 
  Package, 
  Truck, 
  AlertTriangle,
  Play,
  ClipboardCheck,
  ArrowRight,
  Ban,
} from 'lucide-react'
import { GRNStatus, POStatus, PRStatus, DocStatus, StockTakeStatus } from '@/generated/prisma'

// Status types for styling
export type StatusType = 'action_required' | 'waiting' | 'in_progress' | 'success' | 'error' | 'neutral'

interface StatusConfig {
  label: string
  shortLabel?: string // For compact displays
  actionHint?: string // What needs to be done
  color: string
  bgColor: string
  icon: React.ReactNode
  type: StatusType
}

// Color mappings by status type
const statusColors: Record<StatusType, { color: string; bgColor: string }> = {
  action_required: { 
    color: 'text-[var(--status-warning)]', 
    bgColor: 'bg-[var(--status-warning-light)]' 
  },
  waiting: { 
    color: 'text-[var(--status-info)]', 
    bgColor: 'bg-[var(--status-info-light)]' 
  },
  in_progress: { 
    color: 'text-[var(--accent-primary)]', 
    bgColor: 'bg-[var(--accent-light)]' 
  },
  success: { 
    color: 'text-[var(--status-success)]', 
    bgColor: 'bg-[var(--status-success-light)]' 
  },
  error: { 
    color: 'text-[var(--status-error)]', 
    bgColor: 'bg-[var(--status-error-light)]' 
  },
  neutral: { 
    color: 'text-[var(--text-muted)]', 
    bgColor: 'bg-[var(--bg-tertiary)]' 
  },
}

// ============ GRN Status ============
export const grnStatusConfig: Record<GRNStatus, StatusConfig> = {
  DRAFT: {
    label: 'รอบันทึกสต๊อค',
    shortLabel: 'รอบันทึก',
    actionHint: 'กดปุ่ม "บันทึกเข้าสต๊อค" เพื่อรับสินค้าเข้าคลัง',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    type: 'action_required',
    ...statusColors.action_required,
  },
  POSTED: {
    label: 'บันทึกแล้ว',
    shortLabel: 'บันทึกแล้ว',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    type: 'success',
    ...statusColors.success,
  },
  CANCELLED: {
    label: 'ยกเลิก',
    shortLabel: 'ยกเลิก',
    icon: <XCircle className="w-3.5 h-3.5" />,
    type: 'error',
    ...statusColors.error,
  },
}

// ============ PO Status ============
export const poStatusConfig: Record<POStatus, StatusConfig> = {
  DRAFT: {
    label: 'ร่าง - รอส่งอนุมัติ',
    shortLabel: 'ร่าง',
    actionHint: 'กด "ส่งอนุมัติ" เพื่อขออนุมัติใบสั่งซื้อ',
    icon: <FileText className="w-3.5 h-3.5" />,
    type: 'action_required',
    ...statusColors.action_required,
  },
  SUBMITTED: {
    label: 'รออนุมัติ',
    shortLabel: 'รออนุมัติ',
    actionHint: 'รอผู้มีอำนาจอนุมัติ',
    icon: <Clock className="w-3.5 h-3.5" />,
    type: 'waiting',
    ...statusColors.waiting,
  },
  APPROVED: {
    label: 'อนุมัติแล้ว - รอส่ง Supplier',
    shortLabel: 'อนุมัติแล้ว',
    actionHint: 'กด "ส่งให้ Supplier" เพื่อสั่งซื้อ',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    type: 'action_required',
    ...statusColors.action_required,
  },
  REJECTED: {
    label: 'ไม่อนุมัติ',
    shortLabel: 'ไม่อนุมัติ',
    actionHint: 'แก้ไขและส่งอนุมัติใหม่',
    icon: <XCircle className="w-3.5 h-3.5" />,
    type: 'error',
    ...statusColors.error,
  },
  SENT: {
    label: 'ส่งแล้ว - รอรับของ',
    shortLabel: 'ส่งแล้ว',
    actionHint: 'สร้างใบรับสินค้า (GRN) เมื่อได้รับของ',
    icon: <Send className="w-3.5 h-3.5" />,
    type: 'action_required',
    ...statusColors.action_required,
  },
  IN_PROGRESS: {
    label: 'กำลังรับของ',
    shortLabel: 'กำลังรับ',
    actionHint: 'มี GRN ที่ยังไม่ได้บันทึก',
    icon: <Package className="w-3.5 h-3.5" />,
    type: 'in_progress',
    ...statusColors.in_progress,
  },
  PARTIALLY_RECEIVED: {
    label: 'รับบางส่วน - รอรับเพิ่ม',
    shortLabel: 'รับบางส่วน',
    actionHint: 'สร้าง GRN เพิ่มเมื่อได้รับของส่วนที่เหลือ',
    icon: <Truck className="w-3.5 h-3.5" />,
    type: 'action_required',
    ...statusColors.action_required,
  },
  FULLY_RECEIVED: {
    label: 'รับครบแล้ว',
    shortLabel: 'รับครบ',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    type: 'success',
    ...statusColors.success,
  },
  CLOSED: {
    label: 'ปิดแล้ว',
    shortLabel: 'ปิดแล้ว',
    icon: <Ban className="w-3.5 h-3.5" />,
    type: 'neutral',
    ...statusColors.neutral,
  },
  CANCELLED: {
    label: 'ยกเลิก',
    shortLabel: 'ยกเลิก',
    icon: <XCircle className="w-3.5 h-3.5" />,
    type: 'error',
    ...statusColors.error,
  },
}

// ============ PR Status ============
export const prStatusConfig: Record<PRStatus, StatusConfig> = {
  DRAFT: {
    label: 'ร่าง - รอส่งอนุมัติ',
    shortLabel: 'ร่าง',
    actionHint: 'กด "ส่งอนุมัติ" เพื่อขออนุมัติใบขอซื้อ',
    icon: <FileText className="w-3.5 h-3.5" />,
    type: 'action_required',
    ...statusColors.action_required,
  },
  SUBMITTED: {
    label: 'รออนุมัติ',
    shortLabel: 'รออนุมัติ',
    actionHint: 'รอผู้มีอำนาจอนุมัติ',
    icon: <Clock className="w-3.5 h-3.5" />,
    type: 'waiting',
    ...statusColors.waiting,
  },
  APPROVED: {
    label: 'อนุมัติแล้ว - รอสร้าง PO',
    shortLabel: 'อนุมัติแล้ว',
    actionHint: 'กด "สร้าง PO" เพื่อสร้างใบสั่งซื้อ',
    icon: <ArrowRight className="w-3.5 h-3.5" />,
    type: 'action_required',
    ...statusColors.action_required,
  },
  REJECTED: {
    label: 'ถูกปฏิเสธ',
    shortLabel: 'ปฏิเสธ',
    actionHint: 'แก้ไขและส่งอนุมัติใหม่',
    icon: <XCircle className="w-3.5 h-3.5" />,
    type: 'error',
    ...statusColors.error,
  },
  CONVERTED: {
    label: 'แปลงเป็น PO แล้ว',
    shortLabel: 'แปลงแล้ว',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    type: 'success',
    ...statusColors.success,
  },
  CANCELLED: {
    label: 'ยกเลิก',
    shortLabel: 'ยกเลิก',
    icon: <XCircle className="w-3.5 h-3.5" />,
    type: 'error',
    ...statusColors.error,
  },
}

// ============ Movement (DocStatus) ============
export const movementStatusConfig: Record<DocStatus, StatusConfig> = {
  DRAFT: {
    label: 'ร่าง - รอส่งอนุมัติ',
    shortLabel: 'ร่าง',
    actionHint: 'กด "ส่งอนุมัติ" เพื่อขออนุมัติ',
    icon: <FileText className="w-3.5 h-3.5" />,
    type: 'action_required',
    ...statusColors.action_required,
  },
  SUBMITTED: {
    label: 'รออนุมัติ',
    shortLabel: 'รออนุมัติ',
    actionHint: 'รอผู้มีอำนาจอนุมัติ',
    icon: <Clock className="w-3.5 h-3.5" />,
    type: 'waiting',
    ...statusColors.waiting,
  },
  APPROVED: {
    label: 'อนุมัติแล้ว - รอบันทึก',
    shortLabel: 'อนุมัติแล้ว',
    actionHint: 'กด "บันทึก" เพื่อบันทึกการเคลื่อนไหว',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    type: 'action_required',
    ...statusColors.action_required,
  },
  REJECTED: {
    label: 'ถูกปฏิเสธ',
    shortLabel: 'ปฏิเสธ',
    actionHint: 'แก้ไขและส่งอนุมัติใหม่',
    icon: <XCircle className="w-3.5 h-3.5" />,
    type: 'error',
    ...statusColors.error,
  },
  POSTED: {
    label: 'บันทึกแล้ว',
    shortLabel: 'บันทึกแล้ว',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    type: 'success',
    ...statusColors.success,
  },
  CANCELLED: {
    label: 'ยกเลิก',
    shortLabel: 'ยกเลิก',
    icon: <XCircle className="w-3.5 h-3.5" />,
    type: 'error',
    ...statusColors.error,
  },
  CLOSED: {
    label: 'ปิดแล้ว',
    shortLabel: 'ปิดแล้ว',
    icon: <Ban className="w-3.5 h-3.5" />,
    type: 'neutral',
    ...statusColors.neutral,
  },
}

// ============ Stock Take Status ============
export const stockTakeStatusConfig: Record<StockTakeStatus, StatusConfig> = {
  DRAFT: {
    label: 'ร่าง - รอเริ่มนับ',
    shortLabel: 'ร่าง',
    actionHint: 'กด "เริ่มนับ" เพื่อเริ่มนับสต๊อค',
    icon: <ClipboardCheck className="w-3.5 h-3.5" />,
    type: 'action_required',
    ...statusColors.action_required,
  },
  IN_PROGRESS: {
    label: 'กำลังนับ',
    shortLabel: 'กำลังนับ',
    actionHint: 'กรอกจำนวนที่นับได้แล้วกด "เสร็จสิ้น"',
    icon: <Play className="w-3.5 h-3.5" />,
    type: 'in_progress',
    ...statusColors.in_progress,
  },
  COMPLETED: {
    label: 'นับเสร็จ - รออนุมัติ',
    shortLabel: 'รออนุมัติ',
    actionHint: 'รอผู้มีอำนาจอนุมัติการปรับสต๊อค',
    icon: <Clock className="w-3.5 h-3.5" />,
    type: 'waiting',
    ...statusColors.waiting,
  },
  APPROVED: {
    label: 'อนุมัติแล้ว',
    shortLabel: 'อนุมัติแล้ว',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    type: 'success',
    ...statusColors.success,
  },
  CANCELLED: {
    label: 'ยกเลิก',
    shortLabel: 'ยกเลิก',
    icon: <XCircle className="w-3.5 h-3.5" />,
    type: 'error',
    ...statusColors.error,
  },
}

// Helper function to get combined class for badge
export function getStatusBadgeClass(type: StatusType): string {
  const colors = statusColors[type]
  return `${colors.bgColor} ${colors.color}`
}

// Check if status requires action
export function isActionRequired(type: StatusType): boolean {
  return type === 'action_required'
}

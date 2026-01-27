'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import type { ActionResult } from '@/types'

// Types for pending actions
export interface PendingAction {
  id: string
  type: 'grn_draft' | 'po_approved' | 'po_sent' | 'pr_submitted' | 'movement_approved' | 'stock_take_completed'
  docNumber: string
  title: string
  description: string
  url: string
  createdAt: Date
  daysOld: number
}

export interface PendingActionsSummary {
  grnDraft: number
  poApproved: number
  poSent: number
  prSubmitted: number
  movementApproved: number
  stockTakeCompleted: number
  total: number
  actions: PendingAction[]
}

/**
 * Get all pending actions that require user attention
 */
export async function getPendingActions(): Promise<ActionResult<PendingActionsSummary>> {
  const session = await getSession()
  if (!session) {
    return { success: false, error: 'ไม่ได้เข้าสู่ระบบ' }
  }

  try {
    const now = new Date()
    const actions: PendingAction[] = []

    // 1. GRN Draft - รอบันทึกสต๊อค
    const grnDrafts = await prisma.gRN.findMany({
      where: { status: 'DRAFT' },
      include: { po: { include: { supplier: true } } },
      orderBy: { createdAt: 'asc' },
    })
    
    for (const grn of grnDrafts) {
      const daysOld = Math.floor((now.getTime() - grn.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      actions.push({
        id: grn.id,
        type: 'grn_draft',
        docNumber: grn.grnNumber,
        title: `GRN ${grn.grnNumber} รอบันทึกสต๊อค`,
        description: `จาก ${grn.po.supplier.name} - สร้างเมื่อ ${daysOld} วันที่แล้ว`,
        url: `/grn/${grn.id}`,
        createdAt: grn.createdAt,
        daysOld,
      })
    }

    // 2. PO Approved - รอส่งให้ Supplier
    const poApproved = await prisma.pO.findMany({
      where: { status: 'APPROVED' },
      include: { supplier: true },
      orderBy: { createdAt: 'asc' },
    })
    
    for (const po of poApproved) {
      const daysOld = Math.floor((now.getTime() - po.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      actions.push({
        id: po.id,
        type: 'po_approved',
        docNumber: po.poNumber,
        title: `PO ${po.poNumber} รอส่งให้ Supplier`,
        description: `${po.supplier.name} - อนุมัติแล้ว รอส่ง`,
        url: `/po/${po.id}`,
        createdAt: po.createdAt,
        daysOld,
      })
    }

    // 3. PO Sent - รอรับของ
    const poSent = await prisma.pO.findMany({
      where: { status: 'SENT' },
      include: { supplier: true },
      orderBy: { eta: 'asc' },
    })
    
    for (const po of poSent) {
      const daysOverdue = po.eta ? Math.floor((now.getTime() - po.eta.getTime()) / (1000 * 60 * 60 * 24)) : 0
      actions.push({
        id: po.id,
        type: 'po_sent',
        docNumber: po.poNumber,
        title: `PO ${po.poNumber} รอรับของ`,
        description: `${po.supplier.name}${daysOverdue > 0 ? ` - เลย ETA ${daysOverdue} วัน` : ''}`,
        url: `/po/${po.id}`,
        createdAt: po.createdAt,
        daysOld: daysOverdue,
      })
    }

    // 4. PR Submitted - รออนุมัติ
    const prSubmitted = await prisma.pR.findMany({
      where: { status: 'SUBMITTED' },
      include: { requester: true },
      orderBy: { createdAt: 'asc' },
    })
    
    for (const pr of prSubmitted) {
      const daysOld = Math.floor((now.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      actions.push({
        id: pr.id,
        type: 'pr_submitted',
        docNumber: pr.prNumber,
        title: `PR ${pr.prNumber} รออนุมัติ`,
        description: `จาก ${pr.requester.name} - รอ ${daysOld} วัน`,
        url: `/pr/${pr.id}`,
        createdAt: pr.createdAt,
        daysOld,
      })
    }

    // 5. Movement Approved - รอบันทึก
    const movementApproved = await prisma.stockMovement.findMany({
      where: { status: 'APPROVED' },
      include: { createdBy: true },
      orderBy: { createdAt: 'asc' },
    })
    
    for (const mov of movementApproved) {
      const daysOld = Math.floor((now.getTime() - mov.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      actions.push({
        id: mov.id,
        type: 'movement_approved',
        docNumber: mov.docNumber,
        title: `${mov.docNumber} รอบันทึก`,
        description: `${mov.type} - อนุมัติแล้ว รอบันทึก`,
        url: `/movements/${mov.id}`,
        createdAt: mov.createdAt,
        daysOld,
      })
    }

    // 6. Stock Take Completed - รออนุมัติ
    const stockTakeCompleted = await prisma.stockTake.findMany({
      where: { status: 'COMPLETED' },
      include: { warehouse: true, countedBy: true },
      orderBy: { createdAt: 'asc' },
    })
    
    for (const st of stockTakeCompleted) {
      const daysOld = Math.floor((now.getTime() - (st.completedAt || st.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      actions.push({
        id: st.id,
        type: 'stock_take_completed',
        docNumber: st.code,
        title: `ตรวจนับ ${st.code} รออนุมัติ`,
        description: `${st.warehouse.name} - นับเสร็จ ${daysOld} วันที่แล้ว`,
        url: `/stock-take/${st.id}`,
        createdAt: st.completedAt || st.createdAt,
        daysOld,
      })
    }

    // Sort by days old (oldest first)
    actions.sort((a, b) => b.daysOld - a.daysOld)

    const summary: PendingActionsSummary = {
      grnDraft: grnDrafts.length,
      poApproved: poApproved.length,
      poSent: poSent.length,
      prSubmitted: prSubmitted.length,
      movementApproved: movementApproved.length,
      stockTakeCompleted: stockTakeCompleted.length,
      total: actions.length,
      actions,
    }

    return { success: true, data: summary }
  } catch (error) {
    console.error('Error getting pending actions:', error)
    return { success: false, error: 'ไม่สามารถโหลดงานค้างได้' }
  }
}

/**
 * Get pending actions for cron job (no session required)
 */
export async function getPendingActionsForCron(): Promise<ActionResult<PendingActionsSummary>> {
  try {
    const now = new Date()
    const actions: PendingAction[] = []

    // Same logic as above but without session check
    const [grnDrafts, poApproved, poSent, prSubmitted, movementApproved, stockTakeCompleted] = await Promise.all([
      prisma.gRN.findMany({
        where: { status: 'DRAFT' },
        include: { po: { include: { supplier: true } } },
      }),
      prisma.pO.findMany({
        where: { status: 'APPROVED' },
        include: { supplier: true },
      }),
      prisma.pO.findMany({
        where: { status: 'SENT' },
        include: { supplier: true },
      }),
      prisma.pR.findMany({
        where: { status: 'SUBMITTED' },
        include: { requester: true },
      }),
      prisma.stockMovement.findMany({
        where: { status: 'APPROVED' },
        include: { createdBy: true },
      }),
      prisma.stockTake.findMany({
        where: { status: 'COMPLETED' },
        include: { warehouse: true, countedBy: true },
      }),
    ])

    // Process GRN
    for (const grn of grnDrafts) {
      const daysOld = Math.floor((now.getTime() - grn.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      actions.push({
        id: grn.id,
        type: 'grn_draft',
        docNumber: grn.grnNumber,
        title: `GRN ${grn.grnNumber} รอบันทึกสต๊อค`,
        description: `จาก ${grn.po.supplier.name}`,
        url: `/grn/${grn.id}`,
        createdAt: grn.createdAt,
        daysOld,
      })
    }

    // Process PO Approved
    for (const po of poApproved) {
      const daysOld = Math.floor((now.getTime() - po.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      actions.push({
        id: po.id,
        type: 'po_approved',
        docNumber: po.poNumber,
        title: `PO ${po.poNumber} รอส่งให้ Supplier`,
        description: po.supplier.name,
        url: `/po/${po.id}`,
        createdAt: po.createdAt,
        daysOld,
      })
    }

    // Process PO Sent
    for (const po of poSent) {
      const daysOverdue = po.eta ? Math.floor((now.getTime() - po.eta.getTime()) / (1000 * 60 * 60 * 24)) : 0
      if (daysOverdue > 0) {
        actions.push({
          id: po.id,
          type: 'po_sent',
          docNumber: po.poNumber,
          title: `PO ${po.poNumber} เลย ETA`,
          description: `${po.supplier.name} - เลย ${daysOverdue} วัน`,
          url: `/po/${po.id}`,
          createdAt: po.createdAt,
          daysOld: daysOverdue,
        })
      }
    }

    // Process PR
    for (const pr of prSubmitted) {
      const daysOld = Math.floor((now.getTime() - pr.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      actions.push({
        id: pr.id,
        type: 'pr_submitted',
        docNumber: pr.prNumber,
        title: `PR ${pr.prNumber} รออนุมัติ`,
        description: `จาก ${pr.requester.name}`,
        url: `/pr/${pr.id}`,
        createdAt: pr.createdAt,
        daysOld,
      })
    }

    // Process Movement
    for (const mov of movementApproved) {
      const daysOld = Math.floor((now.getTime() - mov.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      actions.push({
        id: mov.id,
        type: 'movement_approved',
        docNumber: mov.docNumber,
        title: `${mov.docNumber} รอบันทึก`,
        description: mov.type,
        url: `/movements/${mov.id}`,
        createdAt: mov.createdAt,
        daysOld,
      })
    }

    // Process Stock Take
    for (const st of stockTakeCompleted) {
      const daysOld = Math.floor((now.getTime() - (st.completedAt || st.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      actions.push({
        id: st.id,
        type: 'stock_take_completed',
        docNumber: st.code,
        title: `ตรวจนับ ${st.code} รออนุมัติ`,
        description: st.warehouse.name,
        url: `/stock-take/${st.id}`,
        createdAt: st.completedAt || st.createdAt,
        daysOld,
      })
    }

    actions.sort((a, b) => b.daysOld - a.daysOld)

    return {
      success: true,
      data: {
        grnDraft: grnDrafts.length,
        poApproved: poApproved.length,
        poSent: poSent.filter(po => po.eta && new Date() > po.eta).length,
        prSubmitted: prSubmitted.length,
        movementApproved: movementApproved.length,
        stockTakeCompleted: stockTakeCompleted.length,
        total: actions.length,
        actions,
      },
    }
  } catch (error) {
    console.error('Error getting pending actions:', error)
    return { success: false, error: 'ไม่สามารถโหลดงานค้างได้' }
  }
}

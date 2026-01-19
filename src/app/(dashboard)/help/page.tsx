'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Package,
  Warehouse,
  ArrowRightLeft,
  FileText,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
  Search,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  BookOpen,
  Lightbulb,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  ClipboardList,
  ScanBarcode,
  Users,
  Shield,
} from 'lucide-react'
import Link from 'next/link'

interface GuideSection {
  id: string
  title: string
  icon: React.ReactNode
  description: string
  steps: {
    title: string
    description: string
    link?: string
  }[]
  tips?: string[]
}

const guides: GuideSection[] = [
  {
    id: 'products',
    title: 'จัดการสินค้า',
    icon: <Package className="w-5 h-5" />,
    description: 'เพิ่ม แก้ไข และจัดการข้อมูลสินค้าทั้งหมด รวมถึงตัวเลือกสี ขนาด',
    steps: [
      {
        title: 'เพิ่มสินค้าใหม่',
        description: 'ไปที่หน้าสินค้า แล้วคลิก "เพิ่มสินค้า" กรอกข้อมูล SKU, ชื่อ, หมวดหมู่, และราคา',
        link: '/products/new',
      },
      {
        title: 'สร้างตัวเลือกสินค้า (Variants)',
        description: 'สำหรับสินค้าที่มีหลายสี/ไซส์ ให้เปิด "มีตัวเลือก" แล้วสร้าง matrix ของตัวเลือก',
      },
      {
        title: 'Import สินค้าจาก Excel/CSV',
        description: 'ใช้ฟีเจอร์ Import เพื่อเพิ่มสินค้าจำนวนมากพร้อมกัน',
        link: '/products/import',
      },
    ],
    tips: [
      'ใช้ SKU ที่จำง่ายและสื่อความหมาย เช่น SHIRT-BLK-M',
      'ตั้ง Reorder Point เพื่อให้ระบบแจ้งเตือนเมื่อสินค้าใกล้หมด',
    ],
  },
  {
    id: 'stock',
    title: 'คลังสินค้า',
    icon: <Warehouse className="w-5 h-5" />,
    description: 'ดูยอดคงเหลือสินค้าในแต่ละคลังและตำแหน่งจัดเก็บ',
    steps: [
      {
        title: 'ดูยอดคงเหลือ',
        description: 'ไปที่หน้าคลังสินค้า จะเห็นยอดคงเหลือแยกตามสินค้าและตำแหน่ง',
        link: '/stock',
      },
      {
        title: 'ตั้งค่าคลังและตำแหน่ง',
        description: 'เพิ่มคลังสินค้าและตำแหน่งจัดเก็บ (Location) ในหน้าตั้งค่า',
        link: '/settings/warehouses',
      },
    ],
    tips: [
      'แบ่งตำแหน่งจัดเก็บให้ชัดเจน เช่น A-01, A-02 เพื่อง่ายต่อการค้นหา',
      'ใช้หน้ารายงานสต๊อคเพื่อดูภาพรวมและ Export ข้อมูล',
    ],
  },
  {
    id: 'movements',
    title: 'เคลื่อนไหวสต๊อค',
    icon: <ArrowRightLeft className="w-5 h-5" />,
    description: 'บันทึกการรับเข้า เบิกออก โอนย้าย และปรับยอดสต๊อค',
    steps: [
      {
        title: 'รับสินค้าเข้า (RECEIVE)',
        description: 'เลือกประเภท "รับเข้า" ระบุสินค้า จำนวน และตำแหน่งจัดเก็บ',
        link: '/movements/new',
      },
      {
        title: 'เบิกสินค้าออก (ISSUE)',
        description: 'เลือกประเภท "เบิกออก" ระบุสินค้าและจำนวนที่ต้องการเบิก',
        link: '/movements/new',
      },
      {
        title: 'โอนย้ายระหว่างตำแหน่ง (TRANSFER)',
        description: 'ย้ายสินค้าจากตำแหน่งหนึ่งไปอีกตำแหน่ง',
        link: '/movements/new',
      },
      {
        title: 'ปรับยอดสต๊อค (ADJUST)',
        description: 'ใช้เมื่อต้องการปรับยอดให้ตรงกับของจริง สามารถใส่จำนวนบวกหรือลบได้',
        link: '/movements/new',
      },
    ],
    tips: [
      'ทุกการเคลื่อนไหวต้องผ่านการอนุมัติก่อนจึงจะมีผลกับยอดสต๊อค',
      'ใช้ Barcode Scanner เพื่อความรวดเร็วในการทำงาน',
    ],
  },
  {
    id: 'stock-take',
    title: 'ตรวจนับสต๊อค',
    icon: <ClipboardList className="w-5 h-5" />,
    description: 'สร้างเอกสารตรวจนับและปรับยอดสต๊อคให้ตรงกับของจริง',
    steps: [
      {
        title: 'สร้างเอกสารตรวจนับ',
        description: 'เลือกคลังและตำแหน่งที่ต้องการตรวจนับ ระบบจะดึงยอดปัจจุบันมาให้',
        link: '/stock-take/new',
      },
      {
        title: 'กรอกจำนวนนับได้จริง',
        description: 'นับสินค้าจริงแล้วกรอกจำนวนในระบบ จะเห็นส่วนต่างอัตโนมัติ',
      },
      {
        title: 'อนุมัติและปรับยอด',
        description: 'เมื่ออนุมัติ ระบบจะสร้างรายการปรับยอดอัตโนมัติ',
      },
    ],
    tips: [
      'ควรตรวจนับเป็นประจำ อย่างน้อยเดือนละครั้ง',
      'ปิดการรับ-เบิกสินค้าชั่วคราวขณะตรวจนับเพื่อความแม่นยำ',
    ],
  },
  {
    id: 'purchasing',
    title: 'การจัดซื้อ',
    icon: <ShoppingCart className="w-5 h-5" />,
    description: 'จัดการขั้นตอนการจัดซื้อตั้งแต่ PR, PO จนถึงรับของ',
    steps: [
      {
        title: 'สร้างใบขอซื้อ (PR)',
        description: 'เมื่อต้องการสั่งซื้อสินค้า ให้สร้าง PR แล้วส่งให้ผู้มีอำนาจอนุมัติ',
        link: '/pr/new',
      },
      {
        title: 'อนุมัติและสร้างใบสั่งซื้อ (PO)',
        description: 'เมื่อ PR ได้รับอนุมัติ ระบบจะสร้าง PO ให้อัตโนมัติ หรือสร้างเองก็ได้',
        link: '/po/new',
      },
      {
        title: 'รับของ (GRN)',
        description: 'เมื่อสินค้ามาถึง ให้สร้างใบรับของ โดยอ้างอิง PO',
        link: '/grn',
      },
    ],
    tips: [
      'ใช้รายงาน Auto PR เพื่อดูสินค้าที่ควรสั่งซื้อ',
      'ติดตาม Lead Time ของซัพพลายเออร์เพื่อวางแผนการสั่งซื้อ',
    ],
  },
  {
    id: 'suppliers',
    title: 'ซัพพลายเออร์',
    icon: <Truck className="w-5 h-5" />,
    description: 'จัดการข้อมูลผู้จำหน่ายและติดตามประสิทธิภาพ',
    steps: [
      {
        title: 'เพิ่มซัพพลายเออร์',
        description: 'กรอกข้อมูลชื่อ ที่อยู่ เบอร์โทร และเงื่อนไขการชำระเงิน',
        link: '/suppliers/new',
      },
      {
        title: 'ดูประสิทธิภาพ',
        description: 'ระบบจะคำนวณ Lead Time และ On-time Delivery Rate ให้อัตโนมัติ',
        link: '/reports/supplier-lead-time',
      },
    ],
    tips: [
      'บันทึก Lead Time เฉลี่ยเพื่อใช้ในการวางแผนสั่งซื้อ',
    ],
  },
  {
    id: 'reports',
    title: 'รายงาน',
    icon: <BarChart3 className="w-5 h-5" />,
    description: 'ดูรายงานและวิเคราะห์ข้อมูลสต๊อคเชิงลึก',
    steps: [
      {
        title: 'รายงานสินค้าใกล้หมด',
        description: 'ดูสินค้าที่มียอดต่ำกว่า Reorder Point',
        link: '/reports/low-stock',
      },
      {
        title: 'รายงานการเคลื่อนไหว',
        description: 'ดูประวัติการรับ-เบิกสินค้าแต่ละตัว',
        link: '/reports/ledger',
      },
      {
        title: 'รายงานสินค้าค้างสต๊อค',
        description: 'หาสินค้าที่ไม่เคลื่อนไหวนานเพื่อวางแผนจัดการ',
        link: '/reports/dead-stock',
      },
      {
        title: 'รายงานสต๊อค',
        description: 'ดูยอดคงเหลือพร้อมมูลค่า และ Export ได้',
        link: '/reports/stock',
      },
    ],
    tips: [
      'ใช้ Filter เพื่อดูข้อมูลเฉพาะหมวดหมู่หรือคลังที่ต้องการ',
    ],
  },
  {
    id: 'scan',
    title: 'สแกน Barcode',
    icon: <ScanBarcode className="w-5 h-5" />,
    description: 'ใช้กล้องหรือ Barcode Scanner เพื่อค้นหาสินค้าอย่างรวดเร็ว',
    steps: [
      {
        title: 'เปิดหน้าสแกน',
        description: 'คลิกที่เมนู "สแกน Barcode" แล้วอนุญาตให้ใช้กล้อง',
        link: '/scan',
      },
      {
        title: 'สแกนและดูข้อมูล',
        description: 'เมื่อสแกนได้ ระบบจะแสดงข้อมูลสินค้าและยอดคงเหลือทันที',
      },
    ],
    tips: [
      'พิมพ์ Barcode/QR Code ติดสินค้าเพื่อความสะดวก',
      'ใช้ USB Barcode Scanner เพื่อความเร็วในการทำงาน',
    ],
  },
]

const faqs = [
  {
    question: 'ทำไมยอดสต๊อคไม่เปลี่ยนหลังบันทึกรายการ?',
    answer: 'รายการเคลื่อนไหวต้องผ่านการ "Post" หรืออนุมัติก่อนจึงจะมีผลกับยอดสต๊อค ให้ตรวจสอบสถานะเอกสารว่าเป็น "POSTED" หรือยัง',
  },
  {
    question: 'จะปรับยอดสต๊อคให้ตรงกับของจริงอย่างไร?',
    answer: 'ใช้ประเภท "ADJUST" ในการสร้างรายการเคลื่อนไหว หรือใช้ฟีเจอร์ "ตรวจนับสต๊อค" เพื่อปรับยอดแบบเป็นระบบ',
  },
  {
    question: 'Import สินค้าต้องใช้ไฟล์รูปแบบไหน?',
    answer: 'รองรับไฟล์ CSV และ Excel (.xlsx) ดาวน์โหลด Template ได้จากหน้า Import',
  },
  {
    question: 'จะเพิ่มผู้ใช้งานใหม่ได้อย่างไร?',
    answer: 'ไปที่ ตั้งค่าระบบ > ผู้ใช้งาน แล้วคลิก "เพิ่มผู้ใช้" กำหนด Role และ Permission ได้ตามต้องการ',
  },
  {
    question: 'ต่างกันอย่างไรระหว่าง PR และ PO?',
    answer: 'PR (Purchase Requisition) คือใบขอซื้อที่ต้องรออนุมัติก่อน เมื่ออนุมัติแล้วจึงจะสร้าง PO (Purchase Order) ซึ่งเป็นใบสั่งซื้อจริงที่ส่งให้ซัพพลายเออร์',
  },
]

const shortcuts = [
  { keys: ['Ctrl', 'K'], action: 'เปิด Command Palette' },
  { keys: ['Ctrl', 'S'], action: 'บันทึก' },
  { keys: ['Esc'], action: 'ปิด Modal/ยกเลิก' },
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [expandedFaqs, setExpandedFaqs] = useState<number[]>([])

  const toggleSection = (id: string) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const toggleFaq = (index: number) => {
    setExpandedFaqs(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const filteredGuides = guides.filter(guide =>
    guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guide.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guide.steps.some(step =>
      step.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      step.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)]">
          <BookOpen className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold">คู่มือการใช้งาน</h1>
        <p className="text-[var(--text-muted)] max-w-lg mx-auto">
          เรียนรู้วิธีใช้งานระบบจัดการสต๊อค ตั้งแต่พื้นฐานจนถึงขั้นสูง
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
        <Input
          type="text"
          placeholder="ค้นหาคู่มือ..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/products/new">
          <Card className="hover:border-[var(--accent-primary)] hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4 text-center">
              <Package className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]" />
              <p className="font-medium text-sm">เพิ่มสินค้า</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/movements/new">
          <Card className="hover:border-[var(--accent-primary)] hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4 text-center">
              <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]" />
              <p className="font-medium text-sm">บันทึกเคลื่อนไหว</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/stock-take/new">
          <Card className="hover:border-[var(--accent-primary)] hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4 text-center">
              <ClipboardList className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]" />
              <p className="font-medium text-sm">ตรวจนับสต๊อค</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/reports/stock">
          <Card className="hover:border-[var(--accent-primary)] hover:shadow-md transition-all cursor-pointer group">
            <CardContent className="p-4 text-center">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]" />
              <p className="font-medium text-sm">รายงานสต๊อค</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Guides */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-[var(--accent-primary)]" />
          คู่มือการใช้งาน
        </h2>

        <div className="space-y-3">
          {filteredGuides.map((guide) => (
            <Collapsible
              key={guide.id}
              open={expandedSections.includes(guide.id)}
              onOpenChange={() => toggleSection(guide.id)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-[var(--bg-hover)] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--accent-light)] text-[var(--accent-primary)]">
                          {guide.icon}
                        </div>
                        <div>
                          <CardTitle className="text-base">{guide.title}</CardTitle>
                          <CardDescription className="text-sm mt-0.5">
                            {guide.description}
                          </CardDescription>
                        </div>
                      </div>
                      {expandedSections.includes(guide.id) ? (
                        <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {/* Steps */}
                    <div className="space-y-3">
                      {guide.steps.map((step, index) => (
                        <div key={index} className="flex gap-3">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{step.title}</p>
                            <p className="text-sm text-[var(--text-muted)] mt-0.5">
                              {step.description}
                            </p>
                            {step.link && (
                              <Link
                                href={step.link}
                                className="inline-flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:underline mt-1"
                              >
                                ไปที่หน้านี้ <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tips */}
                    {guide.tips && guide.tips.length > 0 && (
                      <div className="bg-[var(--status-info-light)] rounded-lg p-4">
                        <div className="flex items-center gap-2 text-[var(--status-info)] font-medium mb-2">
                          <Lightbulb className="w-4 h-4" />
                          Tips
                        </div>
                        <ul className="space-y-1">
                          {guide.tips.map((tip, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="w-4 h-4 text-[var(--status-success)] flex-shrink-0 mt-0.5" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </div>

      {/* FAQs */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[var(--accent-primary)]" />
          คำถามที่พบบ่อย (FAQ)
        </h2>

        <Card>
          <CardContent className="p-0 divide-y divide-[var(--border-default)]">
            {faqs.map((faq, index) => (
              <Collapsible
                key={index}
                open={expandedFaqs.includes(index)}
                onOpenChange={() => toggleFaq(index)}
              >
                <CollapsibleTrigger asChild>
                  <div className="p-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-left">{faq.question}</p>
                      {expandedFaqs.includes(index) ? (
                        <ChevronDown className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <p className="text-[var(--text-secondary)] text-sm bg-[var(--bg-secondary)] rounded-lg p-3">
                      {faq.answer}
                    </p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5 text-[var(--accent-primary)]" />
          ปุ่มลัด (Keyboard Shortcuts)
        </h2>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm">{shortcut.action}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, keyIndex) => (
                      <span key={keyIndex}>
                        <kbd className="px-2 py-1 text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded">
                          {key}
                        </kbd>
                        {keyIndex < shortcut.keys.length - 1 && (
                          <span className="mx-1 text-[var(--text-muted)]">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support */}
      <Card className="bg-gradient-to-br from-[var(--accent-light)] to-[var(--bg-secondary)]">
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">ต้องการความช่วยเหลือเพิ่มเติม?</h3>
          <p className="text-[var(--text-muted)] mb-4">
            ติดต่อทีมซัพพอร์ตหรือแจ้งปัญหาการใช้งาน
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="outline">
              <ExternalLink className="w-4 h-4 mr-2" />
              ติดต่อซัพพอร์ต
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

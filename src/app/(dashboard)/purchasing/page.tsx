'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, ShoppingCart, ClipboardList, Plus, FileStack } from 'lucide-react'
import { PageHeader } from '@/components/common'

// Import the content components
import { PRList } from './pr-list'
import { POList } from './po-list'
import { GRNList } from './grn-list'

export default function PurchasingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') || 'pr'

  const handleTabChange = (value: string) => {
    router.push(`/purchasing?tab=${value}`)
  }

  const getNewButtonHref = () => {
    switch (tab) {
      case 'pr': return '/pr/new'
      case 'po': return '/po/new'
      default: return '/pr/new'
    }
  }

  const getNewButtonText = () => {
    switch (tab) {
      case 'pr': return 'สร้าง PR'
      case 'po': return 'สร้าง PO'
      case 'grn': return 'รับสินค้า'
      default: return 'สร้างใหม่'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="เอกสารจัดซื้อ"
        description="จัดการใบขอซื้อ (PR), ใบสั่งซื้อ (PO), และใบรับสินค้า (GRN)"
        icon={<FileStack className="w-6 h-6" />}
        actions={
          tab !== 'grn' && (
            <Button asChild>
              <Link href={getNewButtonHref()}>
                <Plus className="w-4 h-4 mr-2" />
                {getNewButtonText()}
              </Link>
            </Button>
          )
        }
      />

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="pr" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">ใบขอซื้อ</span>
            <span className="sm:hidden">PR</span>
          </TabsTrigger>
          <TabsTrigger value="po" className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            <span className="hidden sm:inline">ใบสั่งซื้อ</span>
            <span className="sm:hidden">PO</span>
          </TabsTrigger>
          <TabsTrigger value="grn" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">รับสินค้า</span>
            <span className="sm:hidden">GRN</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pr" className="mt-6">
          <PRList />
        </TabsContent>

        <TabsContent value="po" className="mt-6">
          <POList />
        </TabsContent>

        <TabsContent value="grn" className="mt-6">
          <GRNList />
        </TabsContent>
      </Tabs>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tag, Plus, Pencil, Trash2, Loader2, Package } from 'lucide-react'
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory 
} from '@/actions/categories'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/common'

interface Category {
  id: string
  name: string
  description: string | null
  active: boolean
  _count: {
    products: number
  }
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    setIsLoading(true)
    try {
      const data = await getCategories()
      setCategories(data)
    } catch {
      toast.error('ไม่สามารถดึงข้อมูลหมวดหมู่ได้')
    } finally {
      setIsLoading(false)
    }
  }

  function openCreateDialog() {
    setDialogMode('create')
    setFormData({ name: '', description: '' })
    setSelectedCategory(null)
    setDialogOpen(true)
  }

  function openEditDialog(category: Category) {
    setDialogMode('edit')
    setFormData({
      name: category.name,
      description: category.description || '',
    })
    setSelectedCategory(category)
    setDialogOpen(true)
  }

  function openDeleteDialog(category: Category) {
    setCategoryToDelete(category)
    setDeleteDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (dialogMode === 'create') {
        const result = await createCategory(formData)
        if (result.success) {
          toast.success('สร้างหมวดหมู่เรียบร้อย')
          setDialogOpen(false)
          loadCategories()
        } else {
          toast.error(result.error)
        }
      } else if (selectedCategory) {
        const result = await updateCategory(selectedCategory.id, formData)
        if (result.success) {
          toast.success('อัปเดตหมวดหมู่เรียบร้อย')
          setDialogOpen(false)
          loadCategories()
        } else {
          toast.error(result.error)
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!categoryToDelete) return
    setIsSubmitting(true)

    try {
      const result = await deleteCategory(categoryToDelete.id)
      if (result.success) {
        toast.success('ลบหมวดหมู่เรียบร้อย')
        setDeleteDialogOpen(false)
        loadCategories()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="หมวดหมู่สินค้า"
          description="จัดการหมวดหมู่สินค้าในระบบ"
          icon={<Tag className="w-6 h-6" />}
        />
        <Button onClick={openCreateDialog}>
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มหมวดหมู่
        </Button>
      </div>

      {/* Categories Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="w-4 h-4 text-[var(--accent-primary)]" />
            รายการหมวดหมู่
            <Badge variant="secondary" className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
              {categories.length} รายการ
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            </div>
          ) : categories.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<Tag className="w-8 h-8" />}
                title="ยังไม่มีหมวดหมู่"
                description="เพิ่มหมวดหมู่เพื่อจัดระเบียบสินค้า"
                action={
                  <Button onClick={openCreateDialog} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่มหมวดหมู่แรก
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อหมวดหมู่</TableHead>
                  <TableHead>คำอธิบาย</TableHead>
                  <TableHead className="text-center">จำนวนสินค้า</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
                          <Tag className="w-4 h-4 text-[var(--accent-primary)]" />
                        </div>
                        {category.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-[var(--text-muted)]">
                      {category.description || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        <Package className="w-3.5 h-3.5 mr-1" />
                        {category._count.products}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(category)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(category)}
                          className="text-[var(--status-error)] hover:text-[var(--status-error)] hover:bg-[var(--status-error-light)]"
                          disabled={category._count.products > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? 'เพิ่มหมวดหมู่' : 'แก้ไขหมวดหมู่'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'create'
                ? 'กรอกข้อมูลหมวดหมู่ใหม่'
                : 'แก้ไขข้อมูลหมวดหมู่'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                ชื่อหมวดหมู่ <span className="text-[var(--status-error)]">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="เช่น เสื้อ, กางเกง"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">คำอธิบาย</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="รายละเอียดเพิ่มเติม..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : dialogMode === 'create' ? (
                  'สร้าง'
                ) : (
                  'บันทึก'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              คุณต้องการลบหมวดหมู่ &quot;{categoryToDelete?.name}&quot; ใช่หรือไม่?
              <br />
              การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isSubmitting}
              variant="destructive"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                'ลบ'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

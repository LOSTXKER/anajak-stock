'use client'

import { useState, useEffect } from 'react'
import { PageHeader, EmptyState } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Warehouse,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Package,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  createLocation,
  updateLocation,
  deleteLocation,
  type WarehouseWithLocations,
  type LocationData,
} from '@/actions/warehouses'

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseWithLocations[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedWarehouses, setExpandedWarehouses] = useState<Set<string>>(new Set())

  // Warehouse dialog state
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseWithLocations | null>(null)
  const [warehouseForm, setWarehouseForm] = useState({ code: '', name: '', address: '' })
  const [savingWarehouse, setSavingWarehouse] = useState(false)

  // Location dialog state
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<LocationData | null>(null)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [locationForm, setLocationForm] = useState({
    code: '',
    name: '',
    zone: '',
    rack: '',
    shelf: '',
    bin: '',
  })
  const [savingLocation, setSavingLocation] = useState(false)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<{ type: 'warehouse' | 'location'; id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadWarehouses()
  }, [])

  async function loadWarehouses() {
    setLoading(true)
    const data = await getWarehouses()
    setWarehouses(data)
    setLoading(false)
  }

  function toggleExpanded(id: string) {
    const newExpanded = new Set(expandedWarehouses)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedWarehouses(newExpanded)
  }

  // Warehouse handlers
  function openCreateWarehouse() {
    setEditingWarehouse(null)
    setWarehouseForm({ code: '', name: '', address: '' })
    setWarehouseDialogOpen(true)
  }

  function openEditWarehouse(warehouse: WarehouseWithLocations) {
    setEditingWarehouse(warehouse)
    setWarehouseForm({
      code: warehouse.code,
      name: warehouse.name,
      address: warehouse.address || '',
    })
    setWarehouseDialogOpen(true)
  }

  async function handleSaveWarehouse() {
    setSavingWarehouse(true)
    try {
      if (editingWarehouse) {
        const result = await updateWarehouse(editingWarehouse.id, warehouseForm)
        if (result.success) {
          toast.success('อัปเดตคลังสำเร็จ')
          setWarehouseDialogOpen(false)
          loadWarehouses()
        } else {
          toast.error(result.error)
        }
      } else {
        const result = await createWarehouse(warehouseForm)
        if (result.success) {
          toast.success('สร้างคลังสำเร็จ')
          setWarehouseDialogOpen(false)
          loadWarehouses()
        } else {
          toast.error(result.error)
        }
      }
    } finally {
      setSavingWarehouse(false)
    }
  }

  // Location handlers
  function openCreateLocation(warehouseId: string) {
    setEditingLocation(null)
    setSelectedWarehouseId(warehouseId)
    setLocationForm({ code: '', name: '', zone: '', rack: '', shelf: '', bin: '' })
    setLocationDialogOpen(true)
  }

  function openEditLocation(location: LocationData) {
    setEditingLocation(location)
    setSelectedWarehouseId(location.warehouseId)
    setLocationForm({
      code: location.code,
      name: location.name,
      zone: location.zone || '',
      rack: location.rack || '',
      shelf: location.shelf || '',
      bin: location.bin || '',
    })
    setLocationDialogOpen(true)
  }

  async function handleSaveLocation() {
    setSavingLocation(true)
    try {
      if (editingLocation) {
        const result = await updateLocation(editingLocation.id, locationForm)
        if (result.success) {
          toast.success('อัปเดตตำแหน่งสำเร็จ')
          setLocationDialogOpen(false)
          loadWarehouses()
        } else {
          toast.error(result.error)
        }
      } else {
        const result = await createLocation({
          warehouseId: selectedWarehouseId,
          ...locationForm,
        })
        if (result.success) {
          toast.success('สร้างตำแหน่งสำเร็จ')
          setLocationDialogOpen(false)
          loadWarehouses()
          // Auto expand the warehouse
          setExpandedWarehouses(prev => new Set([...prev, selectedWarehouseId]))
        } else {
          toast.error(result.error)
        }
      }
    } finally {
      setSavingLocation(false)
    }
  }

  // Delete handlers
  function openDeleteDialog(type: 'warehouse' | 'location', id: string, name: string) {
    setDeletingItem({ type, id, name })
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!deletingItem) return
    setDeleting(true)
    try {
      const result = deletingItem.type === 'warehouse'
        ? await deleteWarehouse(deletingItem.id)
        : await deleteLocation(deletingItem.id)

      if (result.success) {
        toast.success(`ลบ${deletingItem.type === 'warehouse' ? 'คลัง' : 'ตำแหน่ง'}สำเร็จ`)
        setDeleteDialogOpen(false)
        loadWarehouses()
      } else {
        toast.error(result.error)
      }
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="คลังสินค้า"
          description="จัดการคลังและตำแหน่งจัดเก็บ"
          icon={<Warehouse className="w-6 h-6" />}
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="คลังสินค้า"
        description="จัดการคลังและตำแหน่งจัดเก็บ"
        icon={<Warehouse className="w-6 h-6" />}
        actions={
          <Button onClick={openCreateWarehouse} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]">
            <Plus className="w-4 h-4 mr-2" />
            เพิ่มคลัง
          </Button>
        }
      />

      {warehouses.length === 0 ? (
        <EmptyState
          icon={<Warehouse className="w-12 h-12" />}
          title="ยังไม่มีคลังสินค้า"
          description="เริ่มต้นด้วยการสร้างคลังสินค้าแรกของคุณ"
          action={
            <Button onClick={openCreateWarehouse} className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]">
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มคลัง
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {warehouses.map((warehouse) => (
            <Card key={warehouse.id} className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
              <Collapsible
                open={expandedWarehouses.has(warehouse.id)}
                onOpenChange={() => toggleExpanded(warehouse.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        {expandedWarehouses.has(warehouse.id) ? (
                          <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                        )}
                        <div className="p-2 rounded-lg bg-[var(--accent-light)]">
                          <Warehouse className="w-5 h-5 text-[var(--accent-primary)]" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg text-[var(--text-primary)]">
                            {warehouse.name}
                          </CardTitle>
                          <p className="text-sm text-[var(--text-muted)]">
                            รหัส: {warehouse.code} • {warehouse._count.locations} ตำแหน่ง
                          </p>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          warehouse.active
                            ? 'bg-[var(--status-success-light)] text-[var(--status-success)]'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                        }
                      >
                        {warehouse.active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditWarehouse(warehouse)}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDeleteDialog('warehouse', warehouse.id, warehouse.name)}
                        className="text-[var(--text-muted)] hover:text-[var(--status-error)]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {warehouse.address && (
                    <p className="text-sm text-[var(--text-muted)] ml-14">
                      📍 {warehouse.address}
                    </p>
                  )}
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="border-t border-[var(--border-default)] pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          ตำแหน่งในคลัง
                        </h4>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCreateLocation(warehouse.id)}
                          className="border-[var(--border-default)] text-[var(--text-secondary)]"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          เพิ่มตำแหน่ง
                        </Button>
                      </div>

                      {warehouse.locations.length === 0 ? (
                        <div className="text-center py-6 bg-[var(--bg-tertiary)] rounded-lg">
                          <MapPin className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-2" />
                          <p className="text-sm text-[var(--text-muted)]">ยังไม่มีตำแหน่ง</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="border-[var(--border-default)]">
                              <TableHead className="text-[var(--text-muted)]">รหัส</TableHead>
                              <TableHead className="text-[var(--text-muted)]">ชื่อ</TableHead>
                              <TableHead className="text-[var(--text-muted)]">Zone</TableHead>
                              <TableHead className="text-[var(--text-muted)]">Rack/Shelf/Bin</TableHead>
                              <TableHead className="text-[var(--text-muted)]">สต๊อค</TableHead>
                              <TableHead className="text-[var(--text-muted)] w-24"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {warehouse.locations.map((location) => (
                              <TableRow key={location.id} className="border-[var(--border-default)] hover:bg-[var(--bg-hover)]">
                                <TableCell className="font-mono text-[var(--accent-primary)]">
                                  {location.code}
                                </TableCell>
                                <TableCell className="text-[var(--text-primary)]">
                                  {location.name}
                                </TableCell>
                                <TableCell className="text-[var(--text-secondary)]">
                                  {location.zone || '-'}
                                </TableCell>
                                <TableCell className="text-[var(--text-secondary)]">
                                  {[location.rack, location.shelf, location.bin]
                                    .filter(Boolean)
                                    .join('/') || '-'}
                                </TableCell>
                                <TableCell>
                                  {location._count?.stockBalances ? (
                                    <Badge className="bg-[var(--accent-light)] text-[var(--accent-primary)]">
                                      <Package className="w-3 h-3 mr-1" />
                                      {location._count.stockBalances}
                                    </Badge>
                                  ) : (
                                    <span className="text-[var(--text-muted)]">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openEditLocation(location)}
                                      className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openDeleteDialog('location', location.id, location.name)}
                                      className="h-8 w-8 p-0 text-[var(--text-muted)] hover:text-[var(--status-error)]"
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
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      {/* Warehouse Dialog */}
      <Dialog open={warehouseDialogOpen} onOpenChange={setWarehouseDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">
              {editingWarehouse ? 'แก้ไขคลัง' : 'เพิ่มคลังใหม่'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">รหัสคลัง *</Label>
                <Input
                  value={warehouseForm.code}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                  placeholder="เช่น WH01"
                  className="bg-[var(--bg-input)] border-[var(--border-input)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">ชื่อคลัง *</Label>
                <Input
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  placeholder="เช่น คลังหลัก"
                  className="bg-[var(--bg-input)] border-[var(--border-input)] text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)]">ที่อยู่</Label>
              <Textarea
                value={warehouseForm.address}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                placeholder="ที่อยู่คลัง (ถ้ามี)"
                className="bg-[var(--bg-input)] border-[var(--border-input)] text-[var(--text-primary)]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWarehouseDialogOpen(false)}
              className="border-[var(--border-default)] text-[var(--text-secondary)]"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSaveWarehouse}
              disabled={savingWarehouse || !warehouseForm.code || !warehouseForm.name}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
            >
              {savingWarehouse && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingWarehouse ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">
              {editingLocation ? 'แก้ไขตำแหน่ง' : 'เพิ่มตำแหน่งใหม่'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">รหัสตำแหน่ง *</Label>
                <Input
                  value={locationForm.code}
                  onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value })}
                  placeholder="เช่น A01"
                  className="bg-[var(--bg-input)] border-[var(--border-input)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">ชื่อตำแหน่ง *</Label>
                <Input
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="เช่น ชั้น A แถว 1"
                  className="bg-[var(--bg-input)] border-[var(--border-input)] text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--text-secondary)]">Zone</Label>
              <Input
                value={locationForm.zone}
                onChange={(e) => setLocationForm({ ...locationForm, zone: e.target.value })}
                placeholder="เช่น Zone A"
                className="bg-[var(--bg-input)] border-[var(--border-input)] text-[var(--text-primary)]"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">Rack</Label>
                <Input
                  value={locationForm.rack}
                  onChange={(e) => setLocationForm({ ...locationForm, rack: e.target.value })}
                  placeholder="R01"
                  className="bg-[var(--bg-input)] border-[var(--border-input)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">Shelf</Label>
                <Input
                  value={locationForm.shelf}
                  onChange={(e) => setLocationForm({ ...locationForm, shelf: e.target.value })}
                  placeholder="S01"
                  className="bg-[var(--bg-input)] border-[var(--border-input)] text-[var(--text-primary)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--text-secondary)]">Bin</Label>
                <Input
                  value={locationForm.bin}
                  onChange={(e) => setLocationForm({ ...locationForm, bin: e.target.value })}
                  placeholder="B01"
                  className="bg-[var(--bg-input)] border-[var(--border-input)] text-[var(--text-primary)]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLocationDialogOpen(false)}
              className="border-[var(--border-default)] text-[var(--text-secondary)]"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSaveLocation}
              disabled={savingLocation || !locationForm.code || !locationForm.name}
              className="bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)]"
            >
              {savingLocation && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingLocation ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">
              ยืนยันการลบ
            </DialogTitle>
          </DialogHeader>
          <p className="text-[var(--text-secondary)]">
            คุณต้องการลบ{deletingItem?.type === 'warehouse' ? 'คลัง' : 'ตำแหน่ง'} &quot;{deletingItem?.name}&quot; ใช่หรือไม่?
            {deletingItem?.type === 'warehouse' && (
              <span className="block mt-2 text-[var(--status-warning)] text-sm">
                ⚠️ ตำแหน่งทั้งหมดในคลังนี้จะถูกลบด้วย
              </span>
            )}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-[var(--border-default)] text-[var(--text-secondary)]"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[var(--status-error)] hover:bg-[var(--status-error)]/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              ลบ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

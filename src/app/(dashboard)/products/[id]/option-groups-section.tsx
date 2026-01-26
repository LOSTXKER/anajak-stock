'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Settings, Pencil, Plus, X, Loader2, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { updateProductOptionGroups } from '@/actions/products'
import { useRouter } from 'next/navigation'
import { OptionGroup } from '@/types'

interface OptionGroupsSectionProps {
  productId: string
  optionGroups: OptionGroup[]
  variantCount: number
}

export function OptionGroupsSection({ 
  productId, 
  optionGroups: initialGroups,
  variantCount 
}: OptionGroupsSectionProps) {
  const router = useRouter()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [groups, setGroups] = useState<OptionGroup[]>(initialGroups)
  const [newValueInputs, setNewValueInputs] = useState<Record<number, string>>({})

  // Open dialog with current values
  const openDialog = () => {
    setGroups(initialGroups.length > 0 ? [...initialGroups] : [{ name: '', values: [] }])
    setNewValueInputs({})
    setIsDialogOpen(true)
  }

  // Add new group
  const addGroup = () => {
    setGroups([...groups, { name: '', values: [] }])
  }

  // Remove group
  const removeGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index))
  }

  // Update group name
  const updateGroupName = (index: number, name: string) => {
    const newGroups = [...groups]
    newGroups[index] = { ...newGroups[index], name }
    setGroups(newGroups)
  }

  // Add value to group
  const addValueToGroup = (groupIndex: number) => {
    const value = newValueInputs[groupIndex]?.trim()
    if (!value) return

    const newGroups = [...groups]
    if (!newGroups[groupIndex].values.includes(value)) {
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        values: [...newGroups[groupIndex].values, value]
      }
      setGroups(newGroups)
    }
    setNewValueInputs({ ...newValueInputs, [groupIndex]: '' })
  }

  // Remove value from group
  const removeValueFromGroup = (groupIndex: number, valueIndex: number) => {
    const newGroups = [...groups]
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      values: newGroups[groupIndex].values.filter((_, i) => i !== valueIndex)
    }
    setGroups(newGroups)
  }

  // Handle Enter key for adding value
  const handleKeyDown = (e: React.KeyboardEvent, groupIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addValueToGroup(groupIndex)
    }
  }

  // Save changes
  const handleSave = async () => {
    // Filter out empty groups
    const validGroups = groups.filter(g => g.name.trim() && g.values.length > 0)
    
    if (groups.some(g => g.name.trim() && g.values.length === 0)) {
      toast.error('กรุณาเพิ่มค่าให้ทุกกลุ่มตัวเลือก')
      return
    }

    setIsSaving(true)
    try {
      const result = await updateProductOptionGroups(productId, validGroups)
      if (result.success) {
        toast.success('บันทึกตัวเลือกสำเร็จ')
        setIsDialogOpen(false)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setIsSaving(false)
    }
  }

  const hasGroups = initialGroups.length > 0

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-[var(--accent-primary)]" />
              ตัวเลือกสินค้า
            </CardTitle>
            <Button onClick={openDialog} size="sm" variant="outline">
              <Pencil className="w-4 h-4 mr-2" />
              {hasGroups ? 'แก้ไข' : 'กำหนด'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {hasGroups ? (
            <div className="space-y-3">
              {initialGroups.map((group, idx) => (
                <div key={idx}>
                  <p className="text-sm text-[var(--text-muted)] mb-1">{group.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.values.map((value, vIdx) => (
                      <Badge key={vIdx} variant="secondary" className="text-sm">
                        {value}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-sm">
              ยังไม่ได้กำหนดตัวเลือก กดปุ่ม &quot;กำหนด&quot; เพื่อเริ่มต้น
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>จัดการตัวเลือกสินค้า</DialogTitle>
            <DialogDescription>
              กำหนดกลุ่มตัวเลือก เช่น สี, ไซส์ และค่าที่มีในแต่ละกลุ่ม
            </DialogDescription>
          </DialogHeader>

          {variantCount > 0 && (
            <div className="bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-[var(--status-warning)] shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-[var(--status-warning)]">มี Variants อยู่ {variantCount} รายการ</p>
                <p className="text-[var(--text-muted)]">
                  การลบตัวเลือกอาจทำให้ต้องแก้ไข Variants ที่มีอยู่
                </p>
              </div>
            </div>
          )}

          <div className="space-y-6 py-4">
            {groups.map((group, groupIdx) => (
              <div 
                key={groupIdx} 
                className="border border-[var(--border-default)] rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-muted)] shrink-0">
                    กลุ่มที่ {groupIdx + 1}:
                  </span>
                  <Input
                    value={group.name}
                    onChange={(e) => updateGroupName(groupIdx, e.target.value)}
                    placeholder="ชื่อกลุ่ม เช่น สี, ไซส์"
                    className="max-w-[200px]"
                  />
                  {groups.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGroup(groupIdx)}
                      className="text-[var(--status-error)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-2">ค่าในกลุ่มนี้:</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {group.values.map((value, valueIdx) => (
                      <Badge 
                        key={valueIdx} 
                        variant="secondary"
                        className="text-sm py-1 px-2 flex items-center gap-1"
                      >
                        {value}
                        <button
                          type="button"
                          onClick={() => removeValueFromGroup(groupIdx, valueIdx)}
                          className="ml-1 hover:text-[var(--status-error)]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      value={newValueInputs[groupIdx] || ''}
                      onChange={(e) => setNewValueInputs({ 
                        ...newValueInputs, 
                        [groupIdx]: e.target.value 
                      })}
                      onKeyDown={(e) => handleKeyDown(e, groupIdx)}
                      placeholder="พิมพ์ค่าแล้วกด Enter"
                      className="max-w-[200px]"
                    />
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => addValueToGroup(groupIdx)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addGroup}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มกลุ่มตัวเลือก
            </Button>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

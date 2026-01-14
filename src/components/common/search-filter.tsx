/**
 * SearchFilter - Reusable search and filter bar
 * 
 * @example
 * <SearchFilter
 *   placeholder="ค้นหาสินค้า..."
 *   filters={[
 *     { key: 'category', label: 'หมวดหมู่', options: categories },
 *   ]}
 *   onSearch={(params) => console.log(params)}
 * />
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FilterOption {
  value: string
  label: string
}

interface FilterConfig {
  key: string
  label: string
  options: FilterOption[]
  placeholder?: string
}

interface SearchFilterProps {
  placeholder?: string
  filters?: FilterConfig[]
  showClearButton?: boolean
  className?: string
}

export function SearchFilter({
  placeholder = 'ค้นหา...',
  filters = [],
  showClearButton = true,
  className = '',
}: SearchFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '')

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())

      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }

      // Reset to page 1 when filters change
      if (key !== 'page') {
        params.set('page', '1')
      }

      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      updateParams('search', searchValue)
    },
    [searchValue, updateParams]
  )

  const clearAllFilters = useCallback(() => {
    setSearchValue('')
    router.push(pathname)
  }, [pathname, router])

  const hasActiveFilters =
    searchParams.get('search') ||
    filters.some((f) => searchParams.get(f.key))

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap gap-4">
        {/* Search input */}
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <Input
              type="text"
              placeholder={placeholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-10 bg-[var(--bg-primary)] border-[var(--border-default)]"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => {
                  setSearchValue('')
                  updateParams('search', '')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Filter dropdowns */}
        {filters.map((filter) => (
          <Select
            key={filter.key}
            value={searchParams.get(filter.key) || '__all__'}
            onValueChange={(value) => updateParams(filter.key, value === '__all__' ? '' : value)}
          >
            <SelectTrigger className="w-[180px] bg-[var(--bg-primary)] border-[var(--border-default)]">
              <SelectValue placeholder={filter.placeholder || filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">ทั้งหมด</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

        {/* Clear button */}
        {showClearButton && hasActiveFilters && (
          <Button
            variant="outline"
            onClick={clearAllFilters}
            className="border-[var(--border-default)] text-[var(--text-secondary)]"
          >
            <X className="w-4 h-4 mr-2" />
            ล้างตัวกรอง
          </Button>
        )}
      </div>
    </div>
  )
}

// Simple search only (no filters)
interface SimpleSearchProps {
  placeholder?: string
  className?: string
}

export function SimpleSearch({
  placeholder = 'ค้นหา...',
  className = '',
}: SimpleSearchProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '')

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const params = new URLSearchParams(searchParams.toString())

      if (searchValue) {
        params.set('search', searchValue)
        params.set('page', '1')
      } else {
        params.delete('search')
      }

      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, searchParams, searchValue]
  )

  return (
    <form onSubmit={handleSearch} className={className}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-10 bg-[var(--bg-primary)] border-[var(--border-default)]"
        />
      </div>
    </form>
  )
}

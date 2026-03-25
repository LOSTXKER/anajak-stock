'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import type { CronJobConfig } from '@/actions/cron-settings'
import { utcToThaiHour, thaiToUtcHour } from '@/lib/cron-utils'
import { formatDateTime } from '@/lib/date'

export interface CronJobCardProps {
  config: CronJobConfig
  onUpdate: (config: CronJobConfig) => void
  onRun: () => void
  isRunning: boolean
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'จ.' },
  { value: 2, label: 'อ.' },
  { value: 3, label: 'พ.' },
  { value: 4, label: 'พฤ.' },
  { value: 5, label: 'ศ.' },
  { value: 6, label: 'ส.' },
  { value: 0, label: 'อา.' },
]

export function CronJobCard({ config, onUpdate, onRun, isRunning }: CronJobCardProps) {
  const thaiHour = utcToThaiHour(config.hour)

  const toggleDay = (day: number) => {
    const newDays = config.days.includes(day)
      ? config.days.filter(d => d !== day)
      : [...config.days, day].sort()
    onUpdate({ ...config, days: newDays })
  }

  return (
    <div className={`p-4 rounded-lg border ${config.enabled ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5' : 'border-[var(--border-default)] bg-[var(--bg-secondary)]'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => onUpdate({ ...config, enabled })}
            />
            <div>
              <h4 className="font-medium text-[var(--text-primary)]">{config.name}</h4>
              <p className="text-xs text-[var(--text-muted)]">{config.description}</p>
            </div>
          </div>

          {config.enabled && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-4">
                <Label className="text-sm w-16">เวลา</Label>
                <div className="flex items-center gap-2">
                  <select
                    value={thaiHour}
                    onChange={(e) => onUpdate({ ...config, hour: thaiToUtcHour(Number(e.target.value)) })}
                    className="w-20 h-9 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 text-sm"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                    ))}
                  </select>
                  <span className="text-sm text-[var(--text-muted)]">น.</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Label className="text-sm w-16">วัน</Label>
                <div className="flex flex-wrap gap-1">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                        config.days.includes(day.value)
                          ? 'bg-[var(--accent-primary)] text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {config.lastRun && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span>รันล่าสุด: {formatDateTime(new Date(config.lastRun))}</span>
                  {config.lastStatus === 'success' && (
                    <Badge className="bg-[var(--status-success-light)] text-[var(--status-success)] text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      สำเร็จ
                    </Badge>
                  )}
                  {config.lastStatus === 'error' && (
                    <Badge className="bg-[var(--status-error-light)] text-[var(--status-error)] text-[10px]">
                      <XCircle className="w-3 h-3 mr-1" />
                      ผิดพลาด
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRun}
          disabled={isRunning || !config.enabled}
        >
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-1" />
              รันทันที
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Package,
  ArrowRightLeft,
  BarChart3,
  Settings,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  CheckCircle2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface WelcomeTourProps {
  userName?: string
  onComplete?: () => void
}

interface TourStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  action?: {
    label: string
    href: string
  }
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'ยินดีต้อนรับสู่ระบบจัดการสต๊อค!',
    description: 'ระบบนี้ช่วยให้คุณจัดการสินค้าคงคลังได้อย่างมีประสิทธิภาพ ไม่ว่าจะเป็นการรับเข้า เบิกออก หรือติดตามยอดคงเหลือ',
    icon: <Sparkles className="w-8 h-8" />,
  },
  {
    id: 'products',
    title: 'เริ่มต้นด้วยการเพิ่มสินค้า',
    description: 'สร้างรายการสินค้าพร้อมข้อมูล SKU, หมวดหมู่, และราคา คุณสามารถ Import จาก Excel ได้ด้วย',
    icon: <Package className="w-8 h-8" />,
    action: {
      label: 'เพิ่มสินค้า',
      href: '/products/new',
    },
  },
  {
    id: 'movements',
    title: 'บันทึกการเคลื่อนไหวสต๊อค',
    description: 'เมื่อมีสินค้าแล้ว คุณสามารถบันทึกการรับเข้า เบิกออก โอนย้าย หรือปรับยอดได้ทันที',
    icon: <ArrowRightLeft className="w-8 h-8" />,
    action: {
      label: 'สร้างรายการ',
      href: '/movements/new',
    },
  },
  {
    id: 'reports',
    title: 'ติดตามรายงานและวิเคราะห์',
    description: 'ดูรายงานสต๊อค สินค้าใกล้หมด การเคลื่อนไหว และอื่นๆ เพื่อวางแผนธุรกิจ',
    icon: <BarChart3 className="w-8 h-8" />,
    action: {
      label: 'ดูรายงาน',
      href: '/reports/stock',
    },
  },
  {
    id: 'settings',
    title: 'ตั้งค่าตามความต้องการ',
    description: 'เพิ่มคลังสินค้า หมวดหมู่ ผู้ใช้งาน และปรับแต่งระบบให้เหมาะกับธุรกิจของคุณ',
    icon: <Settings className="w-8 h-8" />,
    action: {
      label: 'ตั้งค่าระบบ',
      href: '/settings',
    },
  },
]

export function WelcomeTour({ userName, onComplete }: WelcomeTourProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasSeenTour, setHasSeenTour] = useState(true) // Default to true to prevent flash

  useEffect(() => {
    // Check if user has seen the tour
    const seen = localStorage.getItem('welcome-tour-completed')
    if (!seen) {
      setHasSeenTour(false)
      setIsOpen(true)
    }
  }, [])

  const handleComplete = () => {
    localStorage.setItem('welcome-tour-completed', 'true')
    setIsOpen(false)
    setHasSeenTour(true)
    onComplete?.()
  }

  const handleSkip = () => {
    localStorage.setItem('welcome-tour-completed', 'true')
    setIsOpen(false)
    setHasSeenTour(true)
  }

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (hasSeenTour) {
    return null
  }

  const step = tourSteps[currentStep]

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">ข้าม</span>
        </button>

        <div className="text-center space-y-6 py-4">
          {/* Progress */}
          <div className="flex justify-center gap-2">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  index === currentStep
                    ? "bg-[var(--accent-primary)]"
                    : index < currentStep
                    ? "bg-[var(--status-success)]"
                    : "bg-[var(--border-default)]"
                )}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--accent-light)] text-[var(--accent-primary)]">
            {step.icon}
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">
              {currentStep === 0 && userName ? `สวัสดี, ${userName}!` : ''} {step.title}
            </h2>
            <p className="text-[var(--text-muted)] text-sm max-w-sm mx-auto">
              {step.description}
            </p>
          </div>

          {/* Action */}
          {step.action && (
            <Link href={step.action.href}>
              <Button variant="outline" className="gap-2" onClick={handleComplete}>
                {step.action.label}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-default)]">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              ย้อนกลับ
            </Button>

            <Button
              onClick={handleNext}
              className="gap-1"
            >
              {currentStep === tourSteps.length - 1 ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  เริ่มใช้งาน
                </>
              ) : (
                <>
                  ถัดไป
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Onboarding checklist for dashboard
interface OnboardingChecklistProps {
  hasProducts: boolean
  hasMovements: boolean
  hasLocations: boolean
}

export function OnboardingChecklist({ hasProducts, hasMovements, hasLocations }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(true) // Default to dismissed to prevent flash

  useEffect(() => {
    const isDismissed = localStorage.getItem('onboarding-checklist-dismissed')
    if (!isDismissed && (!hasProducts || !hasMovements || !hasLocations)) {
      setDismissed(false)
    }
  }, [hasProducts, hasMovements, hasLocations])

  if (dismissed || (hasProducts && hasMovements && hasLocations)) {
    return null
  }

  const tasks = [
    {
      id: 'locations',
      title: 'ตั้งค่าคลังและตำแหน่ง',
      description: 'เพิ่มคลังสินค้าและตำแหน่งจัดเก็บ',
      completed: hasLocations,
      href: '/settings/warehouses',
    },
    {
      id: 'products',
      title: 'เพิ่มสินค้า',
      description: 'สร้างรายการสินค้าที่ต้องการจัดการ',
      completed: hasProducts,
      href: '/products/new',
    },
    {
      id: 'movements',
      title: 'บันทึกการเคลื่อนไหว',
      description: 'รับเข้าหรือบันทึกยอดเริ่มต้น',
      completed: hasMovements,
      href: '/movements/new',
    },
  ]

  const completedCount = tasks.filter(t => t.completed).length

  return (
    <Card className="border-[var(--accent-primary)] bg-gradient-to-br from-[var(--accent-light)] to-[var(--bg-elevated)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
              เริ่มต้นใช้งาน
            </CardTitle>
            <CardDescription className="mt-1">
              ทำตามขั้นตอนเหล่านี้เพื่อเริ่มใช้งานระบบ ({completedCount}/{tasks.length})
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.setItem('onboarding-checklist-dismissed', 'true')
              setDismissed(true)
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((task) => (
          <Link key={task.id} href={task.href}>
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                task.completed
                  ? "bg-[var(--status-success-light)]"
                  : "bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)]"
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center",
                  task.completed
                    ? "bg-[var(--status-success)] text-white"
                    : "border-2 border-[var(--border-default)]"
                )}
              >
                {task.completed && <CheckCircle2 className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <p className={cn(
                  "font-medium text-sm",
                  task.completed && "line-through text-[var(--text-muted)]"
                )}>
                  {task.title}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{task.description}</p>
              </div>
              {!task.completed && (
                <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

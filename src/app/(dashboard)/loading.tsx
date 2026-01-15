import { Loader2 } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-[var(--accent-primary)] animate-spin" />
        <p className="text-[var(--text-muted)] text-sm animate-pulse">กำลังโหลด...</p>
      </div>
    </div>
  )
}

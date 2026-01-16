import { PageSkeleton } from '@/components/ui/skeleton'

export default function StockTakeLoading() {
  return (
    <PageSkeleton 
      hasStats={true}
      statsCount={4}
      hasSearch={false}
      hasTable={true} 
      tableRows={8} 
      tableCols={6} 
    />
  )
}

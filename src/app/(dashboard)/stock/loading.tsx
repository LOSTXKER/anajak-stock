import { PageSkeleton } from '@/components/ui/skeleton'

export default function StockLoading() {
  return (
    <PageSkeleton 
      hasStats={true}
      statsCount={3}
      hasSearch={true} 
      hasTable={true} 
      tableRows={10} 
      tableCols={7} 
    />
  )
}

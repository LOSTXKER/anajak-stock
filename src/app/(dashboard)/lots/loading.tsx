import { PageSkeleton } from '@/components/ui/skeleton'

export default function LotsLoading() {
  return (
    <PageSkeleton 
      hasStats={false} 
      hasSearch={true} 
      hasTable={true} 
      tableRows={10} 
      tableCols={8} 
    />
  )
}

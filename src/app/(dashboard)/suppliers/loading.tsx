import { PageSkeleton } from '@/components/ui/skeleton'

export default function SuppliersLoading() {
  return (
    <PageSkeleton 
      hasStats={false}
      hasSearch={true}
      hasTable={true} 
      tableRows={8} 
      tableCols={5} 
    />
  )
}

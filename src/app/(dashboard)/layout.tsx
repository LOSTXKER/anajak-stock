import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] flex">
      <Sidebar userRole={session.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          user={{
            name: session.name,
            email: session.email,
            role: session.role,
          }}
        />
        <main className="flex-1 p-6 overflow-auto bg-[var(--bg-secondary)]">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

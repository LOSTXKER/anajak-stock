import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Inter, Noto_Sans_Thai, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/common'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
})

const notoSansThai = Noto_Sans_Thai({
  variable: '--font-noto',
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ระบบจัดการสต๊อค | Inventory Management',
  description: 'ระบบจัดการสต๊อคสินค้าครบวงจร พร้อมระบบ PR/PO และรายงานสถิติ',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${notoSansThai.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}

import type { Metadata } from 'next'
import { Inter, DM_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
})

const interDisplay = Inter({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'PriorityGuard — Protect Your Peak Hours',
  description: 'AI-powered cognitive prioritization for freelancers. Stop wasting your best hours on $15/hr tasks.',
}

import { ThemeProvider } from '@/components/ThemeProvider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${interDisplay.variable} ${inter.variable} ${dmMono.variable} font-body bg-cream text-ink antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

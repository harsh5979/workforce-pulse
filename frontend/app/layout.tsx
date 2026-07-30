import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/providers/query-provider';
import { AuthProvider } from '@/components/providers/auth-provider';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'Workforce Pulse | Automation Intelligence Dashboard',
    template: '%s | Workforce Pulse'
  },
  description:
    'Analytics dashboard for identifying workforce automation opportunities. Track repetitive tasks, measure recovery potential in hours and INR, and get AI-powered insights.',
  keywords: ['workforce analytics', 'automation', 'productivity', 'HR analytics', 'dashboard', 'AI operations'],
  authors: [{ name: 'Workforce Pulse Team' }],
  creator: 'Workforce Pulse',
  icons: {
    icon: '/workforce.svg',
    shortcut: '/workforce.svg',
    apple: '/workforce.svg',
  },
  openGraph: {
    title: 'Workforce Pulse',
    description: 'Where are we wasting the most time and money?',
    type: 'website',
    siteName: 'Workforce Pulse',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Workforce Pulse',
    description: 'Where are we wasting the most time and money?',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-[100dvh] overflow-hidden bg-background antialiased">
        <QueryProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './meridian.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.meridianflags.com'),
  title: { default: 'meridian — world geography memory games', template: '%s — meridian' },
  description: 'world geography memory games. know the world properly and put it to the test — daily flag puzzles, ranked sprints, and casual practice across flags, capitals, populations, languages, and borders.',
  applicationName: 'meridian',
  keywords: ['geography game', 'flag game', 'world geography', 'countries quiz', 'memory game', 'daily puzzle', 'capitals quiz', 'geography trivia', 'meridian'],
  authors: [{ name: 'rblabs', url: 'https://rblabs.cloud' }],
  creator: 'rblabs',
  publisher: 'rblabs',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: 'meridian',
    title: 'meridian — world geography memory games',
    description: 'know the world properly and put it to the test. daily puzzles, ranked sprints, and casual practice across flags, capitals, populations, languages, and borders.',
    images: [{ url: '/meridian/branding/og.png', width: 1200, height: 630, alt: 'meridian — world geography memory games' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'meridian — world geography memory games',
    description: 'know the world properly and put it to the test. daily puzzles, ranked sprints, and casual practice.',
    images: ['/meridian/branding/og.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  manifest: '/meridian/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)', sizes: '32x32', type: 'image/png' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0e0f12' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('meridian:theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}` }} />
        <link rel="preload" href="/meridian/fonts/google-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/meridian/data/countries.json" as="fetch" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

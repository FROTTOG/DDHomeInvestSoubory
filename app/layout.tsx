import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://ddhomeinvest.cz'),
  title: {
    default: 'D&D HOMEINVEST s.r.o. | Rodinné projekty s tradicí a stylem',
    template: '%s | D&D HOMEINVEST s.r.o.',
  },
  description:
    'Jsme rodinná firma z jižních Čech. Vracíme život bytům a domům, kterým dáváme nový standard, moderní styl a skutečnou duši. Specializujeme se na rekonstrukce bytů a domů v jižních Čechách.',
  authors: [{ name: 'D&D HOMEINVEST s.r.o.' }],
  keywords: [
    'rekonstrukce',
    'byty',
    'domy',
    'jižní Čechy',
    'D&D HOMEINVEST',
    'stavební projekty',
    'renovace',
    'realita',
    'investice do nemovitostí',
  ],
  creator: 'D&D HOMEINVEST s.r.o.',
  publisher: 'D&D HOMEINVEST s.r.o.',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'D&D HOMEINVEST s.r.o. | Rodinné projekty s tradicí a stylem',
    description: 'Vracíme život starým bytům. Dáváme jim nový standard, moderní styl a skutečnou duši.',
    url: 'https://ddhomeinvest.cz/',
    siteName: 'D&D HOMEINVEST',
    locale: 'cs_CZ',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'D&D HOMEINVEST Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'D&D HOMEINVEST s.r.o. | Rodinné projekty',
    description: 'Vracíme život starým bytům. Dáváme jim nový standard, moderní styl a skutečnou duši.',
    images: ['/logo.png'],
  },
  alternates: {
    canonical: 'https://ddhomeinvest.cz/',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#c9a84c',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <head>
        {/*
          Třída `js` se přidává ještě před vykreslením: scroll-reveal animace
          (`.reveal` v globals.css) skryjí obsah jen tehdy, když běží JS.
          Bez JavaScriptu (nebo při chybě hydration) zůstane obsah viditelný.
        */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js');" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="ios-cache-buster" content={new Date().toISOString().split('T')[0]} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              name: 'D&D HOMEINVEST s.r.o.',
              description: 'Rodinná firma z jižních Čech specializující se na rekonstrukce bytů a domů',
              address: {
                '@type': 'PostalAddress',
                addressLocality: 'České Budějovice',
                addressRegion: 'Jihočeský kraj',
                addressCountry: 'CZ',
              },
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'customer service',
                telephone: '+420725591623',
              },
            }),
          }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

import type { ReactNode } from 'react';
import './globals.css';
import { EnvBanner } from '../components/EnvBanner';
import { LangProvider } from '../components/LangProvider';
import { getDict, getLang } from '../lib/i18n-server';

export function generateMetadata() {
  const t = getDict();
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    openGraph: { title: t.metaTitle, description: t.metaOgDescription, type: 'website' },
  };
}

export const viewport = { themeColor: '#D9531E', width: 'device-width', initialScale: 1, colorScheme: 'only light' };

export default function RootLayout({ children }: { children: ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LangProvider lang={lang}>
          <EnvBanner />
          {children}
        </LangProvider>
      </body>
    </html>
  );
}

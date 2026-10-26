import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PwaRegister } from '@/components/PwaRegister';
import { QuoteProvider } from '@/lib/quote';
import { SessionProvider } from '@/lib/session';
import { ShopProvider } from '@/lib/shop';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prolac · Lácteos frescos',
  description: 'Pide los lácteos frescos de Prolac para recoger en tienda o recibir en casa.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Prolac',
  appleWebApp: { capable: true, title: 'Prolac', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2457A6',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SessionProvider>
          <ShopProvider>
            <QuoteProvider>{children}</QuoteProvider>
          </ShopProvider>
        </SessionProvider>
        <PwaRegister />
      </body>
    </html>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { BottomNav } from '@/components/BottomNav';
import { CartBar } from '@/components/CartBar';

const SIN_NAV = ['/checkout', '/carrito', '/producto'];

export default function ClienteLayout({ children }: { children: ReactNode }) {
  const path = usePathname();
  const sinNav = SIN_NAV.some((p) => path.startsWith(p));
  const sinBarra = path.startsWith('/checkout') || path.startsWith('/carrito') || path.startsWith('/producto');
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-surface shadow-sm">
      <main className={sinNav ? 'pb-28' : 'pb-40'}>{children}</main>
      {!sinBarra && <CartBar />}
      {!sinNav && <BottomNav />}
    </div>
  );
}

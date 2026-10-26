'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './ui';

const ITEMS = [
  { href: '/', label: 'Inicio', icon: 'home' },
  { href: '/buscar', label: 'Buscar', icon: 'search' },
  { href: '/pedidos', label: 'Pedidos', icon: 'receipt' },
  { href: '/cuenta', label: 'Cuenta', icon: 'user' },
] as const;

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-4">
        {ITEMS.map((it) => {
          const active = it.href === '/' ? path === '/' : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? 'page' : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${active ? 'text-brand' : 'text-ink-soft'}`}>
                <Icon name={it.icon} className="h-6 w-6" />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

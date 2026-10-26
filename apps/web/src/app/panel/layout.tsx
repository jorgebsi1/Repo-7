'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSession } from '@/lib/session';

/** Panel de tienda: pensado para una tablet en el mostrador. Botones grandes y alto contraste. */
export default function PanelLayout({ children }: { children: ReactNode }) {
  const { user, ready, logout } = useSession();
  const router = useRouter();
  const path = usePathname();
  const permitido = user && (user.rol === 'tienda' || user.rol === 'admin');

  useEffect(() => {
    if (ready && !permitido) router.replace('/cuenta?next=/panel');
  }, [ready, permitido, router]);

  if (!permitido) return <div className="p-8 text-center text-ink-soft">Verificando acceso…</div>;

  const tab = (href: string, label: string) => (
    <Link href={href} aria-current={path === href ? 'page' : undefined} className={`flex min-h-12 items-center rounded-full px-5 text-base font-semibold ${path === href ? 'bg-brand text-white' : 'text-ink-soft active:bg-muted'}`}>
      {label}
    </Link>
  );

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[1280px] bg-muted">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <strong className="text-lg">Prolac · Panel de tienda</strong>
        <nav className="flex gap-1" aria-label="Panel">
          {tab('/panel', 'Pedidos')}
          {user?.rol === 'tienda' && tab('/panel/agotados', 'Agotados')}
        </nav>
        <span className="ml-auto text-sm text-ink-soft">{user?.nombre}</span>
        <button onClick={() => { logout(); router.replace('/cuenta'); }} className="min-h-12 rounded-full px-4 text-sm font-medium text-ink-soft active:bg-muted">
          Salir
        </button>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}

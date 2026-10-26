'use client';

import Link from 'next/link';
import { money } from '@/lib/format';
import { useQuote } from '@/lib/quote';
import { useShop } from '@/lib/shop';
import { Icon } from './ui';

/** Barra de carrito fija: el objetivo (comprar) siempre a la vista. */
export function CartBar({ aboveNav = true }: { aboveNav?: boolean }) {
  const { count, lineas } = useShop();
  const { quote } = useQuote();
  if (count === 0) return null;
  const unidades = lineas.length;
  return (
    <div className={`fixed left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 px-4 ${aboveNav ? 'bottom-[4.5rem]' : 'bottom-4'}`}>
      <Link href="/carrito" className="flex min-h-14 items-center gap-3 rounded-full bg-ink px-5 text-surface shadow-lg active:opacity-90">
        <Icon name="bag" />
        <span className="font-semibold">Ver carrito</span>
        <span className="rounded-full bg-surface/20 px-2 text-sm">{unidades}</span>
        <span className="ml-auto font-semibold tabular-nums">{quote ? money(quote.totalEstimadoCents) : '…'}</span>
      </Link>
    </div>
  );
}

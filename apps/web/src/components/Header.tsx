'use client';

import Link from 'next/link';
import { useShop } from '@/lib/shop';
import { Icon } from './ui';

/** Cabecera: tienda + conmutador Recojo/Entrega + buscador (patrón de apps de pedidos). */
export function Header({ searchable = true }: { searchable?: boolean }) {
  const { tiendas, tiendaId, setTiendaId, modo, setModo } = useShop();
  const tienda = tiendas.find((t) => t.id === tiendaId);
  return (
    <header className="border-b border-line bg-surface px-4 pb-3 pt-3">
      <div className="space-y-3">
        <label className="relative flex min-h-11 w-full items-center gap-2 rounded-full bg-muted px-4">
          <Icon name="store" className="h-5 w-5 shrink-0 text-brand" />
          <span className="truncate text-sm font-semibold">{tienda ? `${tienda.nombre.replace('[DEMO] ', '')} · ${tienda.ciudad}` : 'Elige tu tienda'}</span>
          <span className="ml-auto rotate-90 text-ink-soft">
            <Icon name="chevron" className="h-4 w-4" />
          </span>
          <select
            aria-label="Tienda"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={tiendaId ?? ''}
            onChange={(e) => setTiendaId(e.target.value)}
          >
            {tiendas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} · {t.ciudad}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label="Modo de entrega" className="grid grid-cols-2 rounded-full bg-muted p-1">
          {(['RECOJO', 'ENTREGA'] as const).map((m) => (
            <button
              key={m}
              aria-pressed={modo === m}
              onClick={() => setModo(m)}
              className={`min-h-10 rounded-full px-3 text-sm font-semibold transition ${modo === m ? 'bg-surface shadow-sm' : 'text-ink-soft'}`}
            >
              {m === 'RECOJO' ? 'Recojo en tienda' : 'Entrega a domicilio'}
            </button>
          ))}
        </div>
      </div>
      {searchable && (
        <Link href="/buscar" className="mt-3 flex min-h-11 items-center gap-2 rounded-full bg-muted px-4 text-ink-soft">
          <Icon name="search" className="h-5 w-5" />
          <span>Buscar leche, yogurt, quesos…</span>
        </Link>
      )}
    </header>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Card, Empty, ErrorBox, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { ESTADO_TEXTO, errorMessage, formatDate, money } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { PedidoResumen } from '@/lib/types';

export default function Pedidos() {
  const { user, ready } = useSession();
  const [items, setItems] = useState<PedidoResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<PedidoResumen[]>('/v1/pedidos').then(setItems).catch((e) => setError(errorMessage(e)));
  }, [user]);

  if (ready && !user) {
    return <Empty title="Inicia sesión para ver tus pedidos" action={<Link href="/cuenta?next=/pedidos" className="inline-flex min-h-12 items-center rounded-control bg-brand px-6 font-semibold text-white">Iniciar sesión</Link>} />;
  }
  return (
    <div>
      <h1 className="px-4 pb-2 pt-5 text-2xl font-bold">Tus pedidos</h1>
      <div className="space-y-3 p-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        {!items && !error && <Skeleton className="h-24" />}
        {items?.length === 0 && <Empty title="Aún no tienes pedidos" text="Cuando compres, aparecerán aquí para que puedas volver a pedir." />}
        {items?.map((p) => {
          const est = ESTADO_TEXTO[p.estado] ?? { label: p.estado, tono: 'neutral' as const };
          return (
            <Link key={p.id} href={`/pedido/${p.id}`} className="block">
              <Card className="p-4 active:bg-muted">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Pedido #{p.numero}</p>
                  <Badge tono={est.tono}>{est.label}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{p.resumen.join(' · ')}{p.lineas > 3 ? ` y ${p.lineas - 3} más` : ''}</p>
                <p className="mt-2 text-sm text-ink-soft">{formatDate(p.creadoEn)} · {p.modo === 'RECOJO' ? 'Recojo' : 'Entrega'} · {money(p.totalFinalCents ?? p.totalEstimadoCents)}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

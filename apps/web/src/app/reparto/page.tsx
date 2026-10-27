'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ColdTimer } from '@/components/ColdTimer';
import { Badge, Button, Card, Empty, ErrorBox } from '@/components/ui';
import { api, streamUrl } from '@/lib/api';
import { errorMessage, money } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { RepartoCard, RepartoDto } from '@/lib/types';

/** Vista del repartidor (móvil): su turno, pedidos listos para salir y pedidos en ruta con la cuenta de frío. */
export default function Reparto() {
  const { user, ready, logout } = useSession();
  const router = useRouter();
  const [d, setD] = useState<RepartoDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const permitido = user && (user.rol === 'repartidor' || user.rol === 'admin');

  const load = useCallback(() => {
    api<RepartoDto>('/v1/reparto/pedidos').then((x) => { setD(x); setError(null); }).catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (ready && !permitido) router.replace('/cuenta?next=/reparto');
  }, [ready, permitido, router]);

  useEffect(() => {
    if (!permitido) return;
    load();
    // Los repartidores también reciben avisos del tablero de su tienda (SSE) y refrescan.
    const url = streamUrl('/v1/tienda/stream');
    const es = url && user?.rol === 'admin' ? new EventSource(url) : null;
    es?.addEventListener('message', load);
    const poll = setInterval(load, 5000);
    return () => {
      es?.close();
      clearInterval(poll);
    };
  }, [permitido, load, user?.rol]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const accion = (id: string, a: string) => run(() => api(`/v1/tienda/pedidos/${id}/${a}`, { body: {} }));

  if (!permitido || !d) return <div className="p-8 text-center text-ink-soft">{error ?? 'Cargando…'}</div>;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-surface pb-10">
      <header className="flex items-center gap-3 border-b border-line p-4">
        <div>
          <p className="text-sm text-ink-soft">Mi reparto</p>
          <h1 className="text-xl font-bold">{user?.nombre.replace('[DEMO] ', '')}</h1>
        </div>
        <button onClick={() => { logout(); router.replace('/cuenta'); }} className="ml-auto min-h-12 rounded-full px-4 text-sm font-medium text-ink-soft active:bg-muted">Salir</button>
      </header>

      <div className="space-y-5 p-4">
        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="font-semibold">{d.enTurno ? 'Estás de turno' : 'Fuera de turno'}</p>
            <p className="text-sm text-ink-soft">{d.enTurno ? 'La tienda te asigna pedidos de entrega.' : 'No recibes pedidos de entrega.'}</p>
          </div>
          <Button variant={d.enTurno ? 'ghost' : 'primary'} disabled={busy} onClick={() => run(() => api('/v1/reparto/turno', { body: { enTurno: !d.enTurno } }))}>
            {d.enTurno ? 'Terminar turno' : 'Iniciar turno'}
          </Button>
        </Card>

        {error && <ErrorBox>{error}</ErrorBox>}

        <section aria-label="En ruta" className="space-y-3">
          <h2 className="text-lg font-bold">En ruta ({d.enRuta.length})</h2>
          {d.enRuta.length === 0 && <p className="rounded-card border border-dashed border-line p-5 text-center text-ink-soft">No llevas pedidos.</p>}
          {d.enRuta.map((p) => (
            <Pedido key={p.id} p={p}>
              {p.limiteFrioEn && (
                <div className="flex items-center justify-between rounded-control bg-muted p-3">
                  <span className="text-sm font-medium">Cooler · meta {d.metaViajeMin} min</span>
                  <ColdTimer limite={p.limiteFrioEn} big />
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={busy} onClick={() => accion(p.id, 'entregar')} className="min-h-14">Entregado</Button>
                <Button variant="ghost" disabled={busy} onClick={() => accion(p.id, 'fallar-entrega')} className="min-h-14">No pude entregar</Button>
              </div>
            </Pedido>
          ))}
        </section>

        <section aria-label="Por salir" className="space-y-3">
          <h2 className="text-lg font-bold">Listos para salir ({d.porSalir.length})</h2>
          {d.porSalir.length === 0 && <Empty title="Nada por recoger" text="Cuando la tienda empaque un pedido de entrega aparecerá aquí." />}
          {d.porSalir.map((p) => (
            <Pedido key={p.id} p={p}>
              <Button block disabled={busy || !d.enTurno} onClick={() => accion(p.id, 'despachar')} className="min-h-14">
                Salir con este pedido (inicia la meta de {d.metaViajeMin} min)
              </Button>
              {!d.enTurno && <p className="text-xs text-ink-soft">Inicia tu turno para poder salir.</p>}
            </Pedido>
          ))}
        </section>
      </div>
    </div>
  );
}

function Pedido({ p, children }: { p: RepartoCard; children: React.ReactNode }) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">#{p.numero}</span>
        <Badge tono="info">{p.estado === 'EN_CAMINO' ? 'En camino' : 'Empacado'}</Badge>
      </div>
      <div>
        <p className="font-medium">{p.cliente}</p>
        <p className="text-ink-soft">{p.direccion?.linea}{p.direccion?.referencia ? ` · ${p.direccion.referencia}` : ''}</p>
        <a href={`tel:${p.telefono}`} className="inline-flex min-h-11 items-center font-medium text-brand">Llamar {p.telefono}</a>
      </div>
      <p className="line-clamp-2 text-sm text-ink-soft">{p.resumen.join(' · ')}</p>
      {p.totalFinalCents != null && <p className="text-sm font-semibold tabular-nums">{money(p.totalFinalCents)}</p>}
      {children}
    </Card>
  );
}

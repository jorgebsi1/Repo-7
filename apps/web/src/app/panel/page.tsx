'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ColdTimer } from '@/components/ColdTimer';
import { Badge, Card, ErrorBox } from '@/components/ui';
import { api, streamUrl } from '@/lib/api';
import { ESTADO_TEXTO, errorMessage, formatTime, money } from '@/lib/format';
import type { PedidoResumen, TiendaRepartoDto } from '@/lib/types';

const COLUMNAS = [
  { titulo: 'Nuevos', estados: ['CONFIRMADO'], vacio: 'Sin pedidos nuevos' },
  { titulo: 'Alistando', estados: ['ALISTANDO', 'FALTANTE'], vacio: 'Nada en alistado' },
  { titulo: 'Empacados / listos', estados: ['EMPACADO', 'LISTO_RECOJO'], vacio: 'Nada por entregar' },
  { titulo: 'En reparto', estados: ['EN_CAMINO'], vacio: 'Sin repartos en curso' },
];
const ESTADOS = COLUMNAS.flatMap((c) => c.estados).join(',');

/** Pitido corto cuando entra un pedido nuevo (WebAudio, sin archivos). */
function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.frequency.value = 880;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.25);
  } catch {
    /* el navegador puede bloquear audio sin interacción previa */
  }
}

export default function Tablero() {
  const [pedidos, setPedidos] = useState<PedidoResumen[] | null>(null);
  const [reparto, setReparto] = useState<TiendaRepartoDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nuevosPrev = useRef<number | null>(null);

  const load = useCallback(() => {
    api<PedidoResumen[]>(`/v1/tienda/pedidos?estado=${ESTADOS}`)
      .then((d) => {
        const nuevos = d.filter((p) => p.estado === 'CONFIRMADO').length;
        if (nuevosPrev.current !== null && nuevos > nuevosPrev.current) beep();
        nuevosPrev.current = nuevos;
        setPedidos(d);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
    api<TiendaRepartoDto>('/v1/tienda/reparto').then(setReparto).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
    const url = streamUrl('/v1/tienda/stream');
    const es = url ? new EventSource(url) : null;
    es?.addEventListener('message', load);
    const poll = setInterval(load, 15_000);
    return () => {
      es?.close();
      clearInterval(poll);
    };
  }, [load]);

  return (
    <div className="space-y-3">
      {error && <ErrorBox>{error}</ErrorBox>}
      {reparto && (
        <Card className="space-y-2 p-4" aria-label="Reparto">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="font-semibold">Reparto</span>
            <span>{reparto.repartidores.length} repartidor(es) de turno</span>
            <span>{reparto.pedidosPorAlistar} por alistar · {reparto.pedidosEsperandoSalir} esperando salir</span>
            <Badge tono={reparto.nivelCarga === 'ALTA' ? 'warn' : 'ok'}>Carga {reparto.nivelCarga === 'ALTA' ? 'alta' : 'normal'}</Badge>
            <span className="text-ink-soft">Un cliente nuevo vería {reparto.estimadoNuevo.minMin}–{reparto.estimadoNuevo.maxMin} min</span>
          </div>
          {reparto.sinRepartidores && (
            <p role="alert" className="rounded-control bg-bad/10 p-3 font-semibold text-bad">
              No hay repartidores de turno. Los pedidos siguen entrando y se estiman con más espera: pon a alguien de turno o sal tú a repartir.
            </p>
          )}
          {reparto.conPromesaVencida.length > 0 && (
            <p className="rounded-control bg-warn/15 p-3 font-semibold text-warn">
              {reparto.conPromesaVencida.length} pedido(s) ya pasaron la hora aproximada que se le dijo al cliente: {reparto.conPromesaVencida.map((x) => `#${x.numero}`).join(', ')}.
            </p>
          )}
          {reparto.enRuta.map((r) => (
            <div key={r.pedidoId} className={`flex flex-wrap items-center gap-x-4 rounded-control p-2 ${r.demorado ? 'bg-warn/15' : 'bg-muted'}`}>
              <span className="font-semibold">#{r.numero} en ruta</span>
              <span className="text-ink-soft">{r.repartidor ? r.repartidor.replace('[DEMO] ', '') : 'sin repartidor asignado (sale la tienda)'}</span>
              {r.limiteFrioEn && <ColdTimer limite={r.limiteFrioEn} />}
            </div>
          ))}
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((c) => {
          const items = (pedidos ?? []).filter((p) => c.estados.includes(p.estado));
          return (
            <section key={c.titulo} aria-label={c.titulo} className="min-w-0">
              <h2 className="mb-2 flex items-center justify-between text-lg font-bold">
                {c.titulo}
                <span className="rounded-full bg-surface px-3 py-0.5 text-base tabular-nums">{items.length}</span>
              </h2>
              <div className="space-y-3">
                {items.length === 0 && <p className="rounded-card border border-dashed border-line p-6 text-center text-ink-soft">{pedidos ? c.vacio : 'Cargando…'}</p>}
                {items.map((p) => {
                  const est = ESTADO_TEXTO[p.estado] ?? { label: p.estado, tono: 'neutral' as const };
                  return (
                    <Link key={p.id} href={`/panel/pedido/${p.id}`} className="block">
                      <Card className="p-4 active:bg-muted">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-lg font-bold">#{p.numero}</span>
                          <Badge tono={est.tono}>{est.label}</Badge>
                        </div>
                        <p className="mt-1 font-medium">{p.cliente}</p>
                        <p className="line-clamp-2 text-sm text-ink-soft">{p.resumen.join(' · ')}{p.lineas > 3 ? ` +${p.lineas - 3}` : ''}</p>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span>{p.modo === 'RECOJO' ? '🛍 Recojo' : '🛵 Entrega'} · {formatTime(p.creadoEn)}</span>
                          <span className="font-semibold tabular-nums">{money(p.totalFinalCents ?? p.totalEstimadoCents)}</span>
                        </div>
                        {p.pendientes > 0 && p.estado === 'ALISTANDO' && <p className="mt-1 text-sm font-semibold text-warn">{p.pendientes} línea(s) por alistar</p>}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

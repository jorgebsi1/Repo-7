'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ColdTimer } from '@/components/ColdTimer';
import { Badge, Button, Card, ErrorBox, Skeleton } from '@/components/ui';
import { api, streamUrl } from '@/lib/api';
import { ESTADO_TEXTO, errorMessage, formatTime, grams, money } from '@/lib/format';
import type { PedidoDto, PedidoLinea } from '@/lib/types';

/** Evento de la máquina de estados → botón del panel. */
const ACCIONES: Record<string, { label: string; path: string; variant: 'primary' | 'secondary' | 'ghost' | 'danger' }> = {
  iniciar_alistado: { label: 'Iniciar alistado', path: 'iniciar-alistado', variant: 'primary' },
  resolver_faltante: { label: 'Continuar alistando', path: 'resolver-faltante', variant: 'primary' },
  reembolsar_por_faltante: { label: 'Reembolsar pedido', path: 'reembolsar-por-faltante', variant: 'danger' },
  empacar: { label: 'Empacar (cobrar total real)', path: 'empacar', variant: 'primary' },
  dejar_listo: { label: 'Dejar listo para recojo', path: 'dejar-listo', variant: 'primary' },
  despachar: { label: 'Despachar', path: 'despachar', variant: 'primary' },
  entregar: { label: 'Marcar entregado', path: 'entregar', variant: 'primary' },
  vencer_recojo: { label: 'Recojo vencido', path: 'vencer-recojo', variant: 'ghost' },
  fallar_entrega: { label: 'Entrega fallida', path: 'fallar-entrega', variant: 'ghost' },
  cancelar: { label: 'Cancelar pedido', path: 'cancelar', variant: 'ghost' },
  reembolsar: { label: 'Reembolsar', path: 'reembolsar', variant: 'danger' },
};

export default function PedidoPanel() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<PedidoDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<PedidoDto>(`/v1/tienda/pedidos/${id}`).then((d) => { setP(d); }).catch((e) => setError(errorMessage(e)));
  }, [id]);

  useEffect(() => {
    load();
    const url = streamUrl('/v1/tienda/stream');
    const es = url ? new EventSource(url) : null;
    es?.addEventListener('message', load);
    return () => es?.close();
  }, [load]);

  const run = async (path: string, body: unknown = {}) => {
    setBusy(true);
    setError(null);
    try {
      setP(await api<PedidoDto>(`/v1/tienda/pedidos/${id}/${path}`, { body }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!p) return <div className="space-y-3"><Skeleton className="h-24" />{error && <ErrorBox>{error}</ErrorBox>}</div>;
  const est = ESTADO_TEXTO[p.estado] ?? { label: p.estado, tono: 'neutral' as const };
  const alistando = p.estado === 'ALISTANDO';
  const enFaltante = p.estado === 'FALTANTE';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/panel" className="inline-flex min-h-12 items-center font-medium text-brand">← Volver al tablero</Link>
      <Card className="space-y-1 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Pedido #{p.numero}</h1>
          <Badge tono={est.tono}>{est.label}</Badge>
          <span className="text-ink-soft">{p.modo === 'RECOJO' ? '🛍 Recojo en tienda' : '🛵 Entrega a domicilio'}</span>
        </div>
        <p className="font-medium">{p.cliente?.nombre} · {p.cliente?.telefono}</p>
        {p.modo === 'ENTREGA' && p.direccion && <p className="text-ink-soft">{p.direccion.linea}{p.direccion.referencia ? ` (${p.direccion.referencia})` : ''}</p>}
        {p.estado === 'EN_CAMINO' && p.entrega?.limiteFrioEn && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold">Cooler · {p.entrega.repartidor?.replace('[DEMO] ', '')} · antes de las {formatTime(p.entrega.limiteFrioEn)}</span>
            <ColdTimer limite={p.entrega.limiteFrioEn} />
          </div>
        )}
        {p.estado === 'EMPACADO' && p.modo === 'ENTREGA' && <p className="font-semibold text-warn">Empacado: los 20 min de frío empiezan cuando el repartidor sale.</p>}
        {p.entrega?.fueraDeFrio && <p className="font-semibold text-bad">Se entregó fuera de la ventana de 20 minutos.</p>}
      </Card>

      {error && <ErrorBox>{error}</ErrorBox>}
      {enFaltante && <ErrorBox>Hay un faltante. Decide si continúas con lo disponible o reembolsas el pedido.</ErrorBox>}

      <section aria-label="Productos" className="space-y-3">
        {p.lineas.map((l) => (
          <LineaCard key={l.id} l={l} activo={alistando} busy={busy} onConfirm={() => run(`lineas/${l.id}/confirmar`)} onWeigh={(g) => run(`lineas/${l.id}/pesar`, { gramosReales: g })} onMissing={() => run(`lineas/${l.id}/faltante`, {})} canMark={alistando || enFaltante} />
        ))}
      </section>

      <Card className="space-y-1 p-4">
        <div className="flex justify-between text-ink-soft"><span>Total estimado</span><span className="tabular-nums">{money(p.totales.totalEstimadoCents)}</span></div>
        <div className="flex justify-between text-ink-soft"><span>Máximo retenido</span><span className="tabular-nums">{money(p.totales.totalAutorizadoCents)}</span></div>
        {p.totales.totalFinalCents != null && <div className="flex justify-between text-lg font-bold"><span>Total cobrado</span><span className="tabular-nums">{money(p.totales.totalFinalCents)}</span></div>}
        {p.pago && <p className="text-sm text-ink-soft">Pago: {p.pago.estado.toLowerCase()}</p>}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {p.acciones.filter((a) => ACCIONES[a]).map((a) => {
          const def = ACCIONES[a]!;
          return (
            <Button key={a} variant={def.variant} disabled={busy} onClick={() => run(def.path)} className="min-h-16 text-lg">
              {def.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function LineaCard({ l, activo, canMark, busy, onConfirm, onWeigh, onMissing }: { l: PedidoLinea; activo: boolean; canMark: boolean; busy: boolean; onConfirm: () => void; onWeigh: (g: number) => void; onMissing: () => void }) {
  const [g, setG] = useState(String(l.gramosFinales ?? l.gramosSolicitados ?? ''));
  const lista = l.estado === 'LISTA';
  const falta = l.estado === 'FALTANTE';
  return (
    <Card className={`p-4 ${falta ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">{l.nombre.replace('[DEMO] ', '')}</p>
          <p className="text-ink-soft">{l.presentacion} · {l.modalidad === 'PACK' ? `x${l.cantidad}` : `pedido: ${grams(l.gramosSolicitados ?? 0)}`}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{money(l.finalCents ?? l.estimadoCents)}</p>
          {lista && <Badge tono="ok">Lista{l.modalidad === 'PESO' && l.gramosFinales ? ` · ${grams(l.gramosFinales)}` : ''}</Badge>}
          {falta && <Badge tono="bad">Faltante</Badge>}
        </div>
      </div>
      {activo && !lista && !falta && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {l.modalidad === 'PACK' ? (
            <Button disabled={busy} onClick={onConfirm} className="min-h-14 flex-1">✓ Producto en la bolsa</Button>
          ) : (
            <>
              <label className="flex-1 text-sm font-medium">Peso real (gramos)
                <input inputMode="numeric" value={g} onChange={(e) => setG(e.target.value.replace(/\D/g, ''))} className="mt-1 min-h-14 w-full rounded-control border border-line bg-surface px-3 text-xl tabular-nums" />
              </label>
              <Button disabled={busy || !g} onClick={() => onWeigh(Number(g))} className="min-h-14">Registrar peso</Button>
            </>
          )}
          <Button variant="ghost" disabled={busy} onClick={onMissing} className="min-h-14">No hay</Button>
        </div>
      )}
      {canMark && !activo && !lista && !falta && (
        <div className="mt-3"><Button variant="ghost" disabled={busy} onClick={onMissing}>No hay</Button></div>
      )}
    </Card>
  );
}

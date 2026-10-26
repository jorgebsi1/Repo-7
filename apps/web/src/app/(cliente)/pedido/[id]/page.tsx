'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, ErrorBox, Icon, Skeleton } from '@/components/ui';
import { OrderSteps } from '@/components/OrderSteps';
import { ApiError, api, streamUrl } from '@/lib/api';
import { ESTADO_TEXTO, errorMessage, formatTime, grams, money } from '@/lib/format';
import { useShop } from '@/lib/shop';
import type { PedidoDto, QuoteDto } from '@/lib/types';

const MENSAJE: Record<string, string> = {
  PAGO_FALLIDO: 'No pudimos procesar el pago. Puedes reintentar o cancelar.',
  CONFIRMADO: 'Recibimos tu pedido. La tienda lo preparará enseguida.',
  ALISTANDO: 'Estamos alistando tus productos.',
  FALTANTE: 'Un producto no estaba disponible. La tienda está ajustando tu pedido.',
  EMPACADO: 'Tu pedido está empacado con frío.',
  LISTO_RECOJO: 'Tu pedido está listo. Pasa a recogerlo.',
  EN_CAMINO: 'Tu pedido va en camino, mantenido en frío.',
  ENTREGADO: '¡Gracias por tu compra!',
  NO_RECOGIDO: 'El pedido no fue recogido a tiempo.',
  FALLIDO_ENTREGA: 'No pudimos entregar tu pedido.',
  REEMBOLSADO: 'Tu dinero fue devuelto o la retención se anuló.',
};

export default function PedidoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { setLines, setModo, setTiendaId } = useShop();
  const [p, setP] = useState<PedidoDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<PedidoDto>(`/v1/pedidos/${id}`)
      .then((d) => {
        setP(d);
        setError(null);
      })
      .catch((e: ApiError) => setError(e.status === 401 ? 'Inicia sesión para ver tu pedido.' : errorMessage(e)));
  }, [id]);

  useEffect(() => {
    load();
    const url = streamUrl(`/v1/pedidos/${id}/stream`);
    const es = url ? new EventSource(url) : null;
    es?.addEventListener('message', load);
    const poll = setInterval(load, 10_000); // respaldo si el canal en vivo se corta
    return () => {
      es?.close();
      clearInterval(poll);
    };
  }, [id, load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const reordenar = () =>
    run(async () => {
      const q = await api<QuoteDto & { ubicacionId: string; modo: 'RECOJO' | 'ENTREGA' }>(`/v1/pedidos/${id}/reordenar`, { method: 'POST', body: {} });
      setTiendaId(q.ubicacionId);
      setModo(q.modo);
      setLines(q.lineas.map((l) => (l.modalidad === 'PACK' ? { skuId: l.skuId, cantidad: l.cantidad ?? 1 } : { skuId: l.skuId, gramos: l.gramos ?? 100 })));
      router.push('/carrito');
    });

  if (error && !p) return <div className="p-4"><ErrorBox>{error}</ErrorBox></div>;
  if (!p) return <div className="space-y-3 p-4"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>;

  const est = ESTADO_TEXTO[p.estado] ?? { label: p.estado, tono: 'neutral' as const };
  const enCurso = p.pasoActual >= 0 && p.pasoActual < 4;
  const pasos = p.modo === 'RECOJO' ? p.pasos.map((x, i) => (i === 3 ? 'Listo para recoger' : x)) : p.pasos.map((x, i) => (i === 3 ? 'En camino' : x));

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line p-3">
        <Link href="/pedidos" aria-label="Mis pedidos" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-muted">
          <Icon name="back" />
        </Link>
        <h1 className="text-xl font-bold">Pedido #{p.numero}</h1>
        <span className="ml-auto"><Badge tono={est.tono}>{est.label}</Badge></span>
      </div>

      <div className="space-y-4 p-4">
        <p className="text-lg font-semibold" role="status">{MENSAJE[p.estado] ?? est.label}</p>
        {p.pasoActual >= 0 && <OrderSteps pasos={pasos} actual={p.pasoActual} />}
        {p.entrega?.limiteFrioEn && p.estado !== 'ENTREGADO' && <p className="text-sm text-ink-soft">Cadena de frío: debe llegar antes de las {formatTime(p.entrega.limiteFrioEn)}.</p>}
        {p.pago?.motivo && p.estado === 'PAGO_FALLIDO' && <ErrorBox>Pago rechazado ({p.pago.motivo.replace('_', ' ').toLowerCase()}).</ErrorBox>}
        {error && <ErrorBox>{error}</ErrorBox>}

        <Card className="divide-y divide-line">
          {p.lineas.map((l) => (
            <div key={l.id} className="flex items-start justify-between gap-3 p-3">
              <div>
                <p className="font-medium">{l.nombre.replace('[DEMO] ', '')}</p>
                <p className="text-sm text-ink-soft">
                  {l.presentacion} · {l.modalidad === 'PACK' ? `x${l.cantidad}` : l.gramosFinales ? `${grams(l.gramosFinales)} (pedido: ${grams(l.gramosSolicitados ?? 0)})` : grams(l.gramosSolicitados ?? 0)}
                </p>
                {l.estado === 'FALTANTE' && <p className="text-sm font-semibold text-warn">No disponible: no se cobra</p>}
              </div>
              <p className={`tabular-nums ${l.estado === 'FALTANTE' ? 'line-through opacity-50' : ''}`}>{money(l.finalCents ?? l.estimadoCents)}</p>
            </div>
          ))}
          <div className="space-y-1 p-3 text-sm">
            {p.totales.tarifaEntregaCents > 0 && <div className="flex justify-between text-ink-soft"><span>Entrega</span><span>{money(p.totales.tarifaEntregaCents)}</span></div>}
            {p.totales.propinaCents > 0 && <div className="flex justify-between text-ink-soft"><span>Propina</span><span>{money(p.totales.propinaCents)}</span></div>}
            <div className="flex justify-between text-base font-bold">
              <span>{p.totales.totalFinalCents != null ? 'Total cobrado' : 'Total estimado'}</span>
              <span className="tabular-nums">{money(p.totales.totalFinalCents ?? p.totales.totalEstimadoCents)}</span>
            </div>
          </div>
        </Card>

        <p className="text-sm text-ink-soft">
          {p.modo === 'RECOJO' ? `Recojo en ${p.tienda?.nombre.replace('[DEMO] ', '')}` : `Entrega en ${p.direccion?.linea}`}
        </p>

        <div className="space-y-2">
          {p.estado === 'PAGO_FALLIDO' && (
            <>
              <Button block disabled={busy} onClick={() => run(() => api(`/v1/pedidos/${id}/reintentar-pago`, { body: { token: 'tok_ok' } }))}>Reintentar con tarjeta de prueba</Button>
              <Button block variant="ghost" disabled={busy} onClick={() => run(() => api(`/v1/pedidos/${id}/cancelar`, { body: {} }))}>Cancelar pedido</Button>
            </>
          )}
          {p.acciones.includes('cancelar') && p.estado === 'CONFIRMADO' && (
            <Button block variant="ghost" disabled={busy} onClick={() => run(() => api(`/v1/pedidos/${id}/cancelar`, { body: {} }))}>Cancelar pedido</Button>
          )}
          {!enCurso && p.estado !== 'PAGO_FALLIDO' && <Button block variant="secondary" disabled={busy} onClick={reordenar}>Volver a pedir</Button>}
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button, Card, Chip, ErrorBox, Icon } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage, money } from '@/lib/format';
import { useQuote } from '@/lib/quote';
import { useSession } from '@/lib/session';
import { DIRECCION_DEMO, useShop } from '@/lib/shop';
import type { PedidoDto } from '@/lib/types';

const PROPINAS = [0, 100, 200, 300];

export default function Checkout() {
  const router = useRouter();
  const { user, ready } = useSession();
  const { tiendaId, tiendas, modo, setModo, direccion, setDireccion, lineas, clear } = useShop();
  const { quote, propinaCents, setPropinaCents } = useQuote();
  const [token, setToken] = useState<'tok_ok' | 'tok_rechazo'>('tok_ok');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linea, setLinea] = useState(direccion?.linea ?? '');
  // Una clave por intento de compra: si el cliente toca dos veces o reintenta, no se duplica el pedido.
  const idemKey = useRef<string>(typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now()));
  const tienda = tiendas.find((t) => t.id === tiendaId);

  if (ready && !user) {
    return (
      <div className="space-y-4 p-6 text-center">
        <h1 className="text-xl font-bold">Inicia sesión para pagar</h1>
        <p className="text-ink-soft">Así podemos avisarte del estado de tu pedido.</p>
        <Link href="/cuenta?next=/checkout" className="inline-flex min-h-12 items-center rounded-control bg-brand px-6 font-semibold text-white">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  const listo = !!quote && quote.puedePedir && (modo === 'RECOJO' || !!direccion);

  const confirmar = async () => {
    if (!tiendaId || !quote) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await api<{ pedido: PedidoDto }>('/v1/pedidos', {
        headers: { 'Idempotency-Key': idemKey.current },
        body: { ubicacionId: tiendaId, modo, lineas, direccion: modo === 'ENTREGA' ? direccion : undefined, propinaCents, pago: { token } },
      });
      clear();
      router.replace(`/pedido/${r.pedido.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setEnviando(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line p-3">
        <button aria-label="Volver" onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-muted">
          <Icon name="back" />
        </button>
        <h1 className="text-xl font-bold">Finalizar pedido</h1>
      </div>

      <div className="space-y-5 p-4">
        <section className="space-y-2">
          <h2 className="font-semibold">¿Cómo lo quieres?</h2>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Modo">
            {(['RECOJO', 'ENTREGA'] as const).map((m) => (
              <button key={m} aria-pressed={modo === m} onClick={() => setModo(m)} className={`min-h-14 rounded-control border-2 px-3 font-semibold ${modo === m ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line'}`}>
                {m === 'RECOJO' ? 'Recojo en tienda' : 'Entrega a domicilio'}
              </button>
            ))}
          </div>
          {modo === 'RECOJO' ? (
            <p className="text-sm text-ink-soft">Recoges en {tienda ? `${tienda.nombre.replace('[DEMO] ', '')} (${tienda.direccion})` : 'la tienda elegida'}.</p>
          ) : (
            <Card className="space-y-3 p-3">
              <label className="block text-sm font-medium" htmlFor="dir">
                Dirección de entrega
              </label>
              <input
                id="dir"
                value={linea}
                onChange={(e) => setLinea(e.target.value)}
                onBlur={() => direccion && setDireccion({ ...direccion, linea })}
                placeholder="Calle, número, distrito"
                className="min-h-12 w-full rounded-control border border-line bg-surface px-3"
              />
              <Button variant="secondary" block onClick={() => { setDireccion({ ...DIRECCION_DEMO, linea: linea || DIRECCION_DEMO.linea }); setLinea(linea || DIRECCION_DEMO.linea); }}>
                {direccion ? 'Dirección confirmada ✓' : 'Usar ubicación de prueba (Las Casuarinas)'}
              </Button>
              <p className="text-xs text-ink-soft">El mapa y la búsqueda de direcciones llegan en los acabados; por ahora se usa una ubicación de prueba dentro de la zona.</p>
              {quote?.entrega && !quote.entrega.ok && <ErrorBox>{errorMessage({ code: quote.entrega.reason, message: '', body: { pedidoMinimoCents: quote.entrega.pedidoMinimoCents } })}</ErrorBox>}
            </Card>
          )}
        </section>

        {modo === 'ENTREGA' && (
          <section className="space-y-2">
            <h2 className="font-semibold">Propina para el repartidor</h2>
            <div className="flex gap-2">
              {PROPINAS.map((p) => (
                <Chip key={p} active={propinaCents === p} onClick={() => setPropinaCents(p)}>
                  {p === 0 ? 'Sin propina' : money(p)}
                </Chip>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold">Pago</h2>
          <Card className="divide-y divide-line">
            {([['tok_ok', 'Tarjeta de prueba (aprobada)'], ['tok_rechazo', 'Tarjeta de prueba (rechazada)']] as const).map(([v, label]) => (
              <label key={v} className="flex min-h-14 cursor-pointer items-center gap-3 px-4">
                <input type="radio" name="pago" checked={token === v} onChange={() => setToken(v)} className="h-5 w-5 accent-[var(--prolac-brand)]" />
                <span>{label}</span>
              </label>
            ))}
          </Card>
          <p className="text-xs text-ink-soft">Pago simulado: no se cobra dinero real. Los pagos reales (tarjeta, Yape, Plin) se conectan en los acabados.</p>
        </section>

        {quote && (
          <Card className="space-y-1 p-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(quote.subtotalCents)}</span></div>
            {modo === 'ENTREGA' && <div className="flex justify-between"><span>Entrega</span><span className="tabular-nums">{quote.entrega?.ok ? money(quote.tarifaEntregaCents) : '—'}</span></div>}
            {propinaCents > 0 && <div className="flex justify-between"><span>Propina</span><span className="tabular-nums">{money(propinaCents)}</span></div>}
            <div className="flex justify-between border-t border-line pt-2 text-lg font-bold"><span>Total estimado</span><span className="tabular-nums">{money(quote.totalEstimadoCents)}</span></div>
            {quote.lineas.some((l) => l.modalidad === 'PESO') && <p className="pt-1 text-xs text-ink-soft">Se retiene hasta {money(quote.totalAutorizadoCents)} y se cobra el total real según el peso.</p>}
          </Card>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button block disabled={!listo || enviando} onClick={confirmar}>
          {enviando ? 'Procesando…' : `Confirmar pedido${quote ? ` · ${money(quote.totalEstimadoCents)}` : ''}`}
        </Button>
      </div>
    </div>
  );
}

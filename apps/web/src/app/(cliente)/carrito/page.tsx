'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, Empty, ErrorBox, Icon, Skeleton, Stepper } from '@/components/ui';
import { errorMessage, grams, money } from '@/lib/format';
import { useQuote } from '@/lib/quote';
import { useShop } from '@/lib/shop';

export default function Carrito() {
  const router = useRouter();
  const { lineas, setQty, removeLine, modo } = useShop();
  const { quote, loading, error } = useQuote();

  if (lineas.length === 0) {
    return <Empty title="Tu carrito está vacío" text="Agrega lácteos frescos para empezar." action={<Button onClick={() => router.push('/')}>Ver productos</Button>} />;
  }

  const hayPeso = quote?.lineas.some((l) => l.modalidad === 'PESO');
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line p-3">
        <button aria-label="Volver" onClick={() => router.back()} className="flex h-11 w-11 items-center justify-center rounded-full active:bg-muted">
          <Icon name="back" />
        </button>
        <h1 className="text-xl font-bold">Tu carrito</h1>
      </div>

      <div className="space-y-3 p-4">
        {error && <ErrorBox>{errorMessage(error)}</ErrorBox>}
        {lineas.map((l, i) => {
          const q = quote?.lineas[i];
          const noDisp = quote?.problemas.some((p) => p.skuId === l.skuId);
          return (
            <Card key={l.skuId} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{q ? q.nombre.replace('[DEMO] ', '') : '…'}</p>
                  <p className="text-sm text-ink-soft">{q?.presentacion}</p>
                  {noDisp && <p className="mt-1 text-sm font-semibold text-bad">No disponible en esta tienda</p>}
                </div>
                <p className="font-semibold tabular-nums">{q ? money(q.estimadoCents) : ''}</p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                {l.gramos !== undefined ? (
                  <Stepper value={l.gramos} min={50} max={3000} step={50} format={grams} onChange={(g) => setQty(i, { skuId: l.skuId, gramos: g })} />
                ) : (
                  <Stepper value={l.cantidad ?? 1} min={1} max={20} onChange={(c) => setQty(i, { skuId: l.skuId, cantidad: c })} />
                )}
                <button onClick={() => removeLine(i)} className="min-h-11 px-3 text-sm font-medium text-bad">
                  Quitar
                </button>
              </div>
            </Card>
          );
        })}

        <Link href="/" className="block py-2 text-center font-medium text-brand">
          + Agregar más productos
        </Link>

        {quote ? (
          <Card className="space-y-2 p-4">
            <Row label="Subtotal" value={money(quote.subtotalCents)} />
            {modo === 'ENTREGA' && <Row label="Entrega" value={quote.entrega?.ok ? (quote.tarifaEntregaCents === 0 ? 'Gratis' : money(quote.tarifaEntregaCents)) : 'Se calcula con tu dirección'} />}
            <div className="border-t border-line pt-2">
              <Row label="Total estimado" value={money(quote.totalEstimadoCents)} strong />
            </div>
            {hayPeso && <p className="text-xs text-ink-soft">Los productos por peso se cobran según el peso real. Retenemos hasta {money(quote.totalAutorizadoCents)} y cobramos solo lo que pese tu pedido.</p>}
          </Card>
        ) : (
          loading && <Skeleton className="h-32" />
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button block disabled={!quote || quote.problemas.length > 0} onClick={() => router.push('/checkout')}>
          Ir a pagar{quote ? ` · ${money(quote.totalEstimadoCents)}` : ''}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'text-lg font-bold' : 'text-ink-soft'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

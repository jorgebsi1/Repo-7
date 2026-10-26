'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { weightPriceCents } from '@prolac/domain';
import { Badge, Button, Chip, Empty, Icon, ProductImage, Skeleton, Stepper } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { formatDate, grams, money } from '@/lib/format';
import { useShop } from '@/lib/shop';

export default function Producto() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tiendaId, addLine } = useShop();
  const { data } = useCatalog(tiendaId);
  const producto = useMemo(() => data?.categorias.flatMap((c) => c.productos).find((p) => p.id === id), [data, id]);
  const [skuId, setSkuId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [gramos, setGramos] = useState(0);

  const sku = producto?.skus.find((s) => s.id === skuId) ?? producto?.skus.find((s) => s.disponible !== false) ?? producto?.skus[0];

  useEffect(() => {
    if (producto && !skuId) setSkuId((producto.skus.find((s) => s.disponible !== false) ?? producto.skus[0])?.id ?? null);
  }, [producto, skuId]);
  useEffect(() => {
    if (sku?.modalidad === 'PESO') setGramos(Math.max(sku.minGramos ?? 100, 300 - (300 % (sku.pasoGramos ?? 50))));
    setCantidad(1);
  }, [sku?.id, sku?.modalidad, sku?.minGramos, sku?.pasoGramos]);

  if (!data) return <div className="space-y-3 p-4"><Skeleton className="aspect-[4/3]" /><Skeleton className="h-8" /></div>;
  if (!producto || !sku) return <Empty title="No encontramos este producto" action={<Button onClick={() => router.push('/')}>Volver al inicio</Button>} />;

  const precio = sku.modalidad === 'PACK' ? (sku.precioCents ?? 0) * cantidad : weightPriceCents(sku.precioKgCents ?? 0, gramos);
  const agotado = sku.disponible === false;
  const nombre = producto.nombre.replace('[DEMO] ', '');

  const agregar = () => {
    addLine(sku.modalidad === 'PACK' ? { skuId: sku.id, cantidad } : { skuId: sku.id, gramos });
    router.back();
  };

  return (
    <div>
      <div className="relative">
        <ProductImage nombre={nombre} src={producto.imagenUrl} className="aspect-[4/3] w-full" />
        <button aria-label="Volver" onClick={() => router.back()} className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface shadow">
          <Icon name="back" />
        </button>
      </div>
      <div className="space-y-5 p-4">
        <div>
          <h1 className="text-2xl font-bold">{nombre}</h1>
          {producto.descripcion && <p className="mt-1 text-ink-soft">{producto.descripcion}</p>}
        </div>

        <section aria-label="Presentación">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">Presentación</h2>
          <div className="flex flex-wrap gap-2">
            {producto.skus.map((s) => (
              <Chip key={s.id} active={s.id === sku.id} onClick={() => setSkuId(s.id)} disabled={s.disponible === false}>
                {s.presentacion}
                {s.disponible === false && ' · agotado'}
              </Chip>
            ))}
          </div>
        </section>

        {sku.modalidad === 'PESO' && (
          <p className="rounded-control bg-brand-soft p-3 text-sm text-brand-strong">
            Lo cortamos y pesamos al momento. {money(sku.precioKgCents ?? 0)} el kilo. El total final se ajusta al peso real (puede variar hasta un 10 %).
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">{sku.modalidad === 'PACK' ? 'Cantidad' : 'Peso'}</span>
          {sku.modalidad === 'PACK' ? (
            <Stepper value={cantidad} min={1} max={20} onChange={setCantidad} />
          ) : (
            <Stepper value={gramos} min={sku.minGramos ?? 100} max={sku.maxGramos ?? 3000} step={sku.pasoGramos ?? 50} onChange={setGramos} format={grams} />
          )}
        </div>

        <ul className="space-y-1 text-sm text-ink-soft">
          {sku.venceEn && <li>Vence el {formatDate(sku.venceEn)} (lote más próximo)</li>}
          {producto.conservacion?.minC != null && <li>Conservar entre {producto.conservacion.minC} y {producto.conservacion.maxC} °C</li>}
          {producto.registroSanitario && <li>Registro sanitario: {producto.registroSanitario}</li>}
        </ul>
        {agotado && <Badge tono="bad">Agotado en esta tienda</Badge>}
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button block disabled={agotado} onClick={agregar}>
          Añadir · {money(precio)}
        </Button>
      </div>
    </div>
  );
}

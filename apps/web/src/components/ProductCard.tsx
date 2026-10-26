'use client';

import Link from 'next/link';
import { desdePrecio } from '@/lib/catalog';
import { money } from '@/lib/format';
import type { ProductoDto } from '@/lib/types';
import { Badge, ProductImage } from './ui';

export function ProductCard({ p, wide = false }: { p: ProductoDto; wide?: boolean }) {
  const precio = desdePrecio(p);
  const sinStock = p.skus.every((s) => s.disponible === false);
  const porPeso = p.skus.some((s) => s.modalidad === 'PESO');
  return (
    <Link href={`/producto/${p.id}`} className={`block ${wide ? 'w-full' : 'w-40 shrink-0'} ${sinStock ? 'opacity-60' : ''}`}>
      <div className="relative overflow-hidden rounded-card">
        <ProductImage nombre={p.nombre} src={p.imagenUrl} className="aspect-[4/3] w-full" />
        {sinStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
            <Badge tono="bad">Agotado</Badge>
          </div>
        )}
        {porPeso && !sinStock && (
          <div className="absolute left-2 top-2">
            <Badge tono="info">Por peso</Badge>
          </div>
        )}
      </div>
      <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{p.nombre.replace('[DEMO] ', '')}</h3>
      {precio && (
        <p className="text-sm text-ink-soft">
          Desde {money(precio.cents)}
          {precio.porKg ? ' / kg' : ''}
        </p>
      )}
    </Link>
  );
}

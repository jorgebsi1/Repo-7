'use client';

import { useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { ProductCard } from '@/components/ProductCard';
import { Empty } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { useShop } from '@/lib/shop';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Buscar() {
  const { tiendaId } = useShop();
  const { data } = useCatalog(tiendaId);
  const [q, setQ] = useState('');
  const resultados = useMemo(() => {
    if (!data) return [];
    const t = norm(q.trim());
    return data.categorias.flatMap((c) => c.productos.filter((p) => !t || norm(`${p.nombre} ${c.nombre} ${p.descripcion ?? ''}`).includes(t)));
  }, [data, q]);

  return (
    <>
      <Header searchable={false} />
      <div className="p-4">
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar leche, yogurt, quesos…"
          aria-label="Buscar productos"
          className="min-h-12 w-full rounded-full border border-line bg-muted px-5 text-base outline-none focus:border-brand"
        />
      </div>
      {resultados.length === 0 ? (
        <Empty title="No encontramos ese producto" text="Prueba con otra palabra, por ejemplo “queso”." />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4">
          {resultados.map((p) => (
            <ProductCard key={p.id} p={p} wide />
          ))}
        </div>
      )}
    </>
  );
}

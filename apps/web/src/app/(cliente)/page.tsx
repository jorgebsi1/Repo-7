'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { ProductCard } from '@/components/ProductCard';
import { Chip, Empty, ErrorBox, Skeleton } from '@/components/ui';
import { useCatalog } from '@/lib/catalog';
import { useShop } from '@/lib/shop';

export default function Inicio() {
  const { tiendaId, ready } = useShop();
  const { data, error } = useCatalog(tiendaId);
  const [activa, setActiva] = useState<string | null>(null);

  if (ready && !tiendaId) {
    return <Empty title="Aún no hay tiendas disponibles" text="Vuelve a intentarlo en unos minutos." />;
  }

  const irA = (slug: string) => {
    setActiva(slug);
    document.getElementById(`cat-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <Header />
      {error && (
        <div className="p-4">
          <ErrorBox>No pudimos cargar el catálogo. {error}</ErrorBox>
        </div>
      )}
      {!data && !error && (
        <div className="space-y-4 p-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}
      {data && (
        <>
          <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-2 no-scrollbar">
            {data.categorias.map((c) => (
              <Chip key={c.id} active={activa === c.slug} onClick={() => irA(c.slug)}>
                {c.nombre}
              </Chip>
            ))}
          </div>
          <div className="space-y-6 py-4">
            {data.categorias.map((c) => (
              <section key={c.id} id={`cat-${c.slug}`} className="scroll-mt-16">
                <h2 className="px-4 pb-3 text-xl font-bold">{c.nombre}</h2>
                <div className="flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar">
                  {c.productos.map((p) => (
                    <ProductCard key={p.id} p={p} />
                  ))}
                </div>
              </section>
            ))}
            <p className="px-4 text-center text-xs text-ink-soft">Catálogo de muestra · fotos y precios finales pendientes</p>
          </div>
        </>
      )}
    </>
  );
}

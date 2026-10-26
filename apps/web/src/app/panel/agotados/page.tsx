'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, ErrorBox } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/format';
import type { CatalogoDto } from '@/lib/types';

/** Marcar productos como agotados (o disponibles) en esta tienda. */
export default function Agotados() {
  const [data, setData] = useState<CatalogoDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<CatalogoDto>('/v1/tienda/catalogo').then(setData).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const toggle = async (skuId: string, disponible: boolean) => {
    try {
      await api(`/v1/tienda/disponibilidad/${skuId}`, { method: 'PATCH', body: { disponible } });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Productos agotados</h1>
      <p className="text-ink-soft">Desactiva lo que se acabó: deja de ofrecerse en la app al instante.</p>
      {error && <ErrorBox>{error}</ErrorBox>}
      {data?.categorias.map((c) => (
        <section key={c.id} className="space-y-2">
          <h2 className="text-lg font-bold">{c.nombre}</h2>
          <Card className="divide-y divide-line">
            {c.productos.flatMap((p) =>
              p.skus.map((s) => (
                <label key={s.id} className="flex min-h-16 cursor-pointer items-center justify-between gap-3 px-4">
                  <span>
                    <span className="font-medium">{p.nombre.replace('[DEMO] ', '')}</span>
                    <span className="block text-sm text-ink-soft">{s.presentacion}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={s.disponible ? 'text-ok' : 'text-bad'}>{s.disponible ? 'Disponible' : 'Agotado'}</span>
                    <input type="checkbox" role="switch" aria-label={`${p.nombre} ${s.presentacion} disponible`} checked={!!s.disponible} onChange={(e) => toggle(s.id, e.target.checked)} className="h-7 w-12 accent-[var(--prolac-brand)]" />
                  </span>
                </label>
              )),
            )}
          </Card>
        </section>
      ))}
    </div>
  );
}

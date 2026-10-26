'use client';

import { useEffect, useState } from 'react';
import { api } from './api';
import type { CatalogoDto } from './types';

const cache = new Map<string, { at: number; data: CatalogoDto }>();

/** Catálogo de una tienda con caché corta (30 s) para navegar sin parpadeos. */
export function useCatalog(tiendaId: string | null) {
  const [data, setData] = useState<CatalogoDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tiendaId) return;
    const hit = cache.get(tiendaId);
    if (hit && Date.now() - hit.at < 30_000) {
      setData(hit.data);
      return;
    }
    setData(null);
    setError(null);
    api<CatalogoDto>(`/v1/ubicaciones/${tiendaId}/catalogo`, { token: null })
      .then((d) => {
        cache.set(tiendaId, { at: Date.now(), data: d });
        setData(d);
      })
      .catch((e: Error) => setError(e.message));
  }, [tiendaId]);

  return { data, error };
}

/** Precio "desde" de un producto, para las tarjetas. */
export function desdePrecio(p: CatalogoDto['categorias'][number]['productos'][number]): { cents: number; porKg: boolean } | null {
  const packs = p.skus.filter((s) => s.modalidad === 'PACK' && s.precioCents != null).map((s) => s.precioCents!);
  if (packs.length) return { cents: Math.min(...packs), porKg: false };
  const kg = p.skus.filter((s) => s.precioKgCents != null).map((s) => s.precioKgCents!);
  return kg.length ? { cents: Math.min(...kg), porKg: true } : null;
}

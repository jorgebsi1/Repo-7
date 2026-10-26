'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, api } from './api';
import { useShop } from './shop';
import type { QuoteDto } from './types';

interface QuoteCtx {
  quote: QuoteDto | null;
  loading: boolean;
  error: ApiError | null;
  propinaCents: number;
  setPropinaCents: (n: number) => void;
}
const Ctx = createContext<QuoteCtx | null>(null);

/** Cotiza en el servidor cada vez que cambia el carrito: el cliente nunca calcula precios finales. */
export function QuoteProvider({ children }: { children: ReactNode }) {
  const { tiendaId, modo, direccion, lineas } = useShop();
  const [quote, setQuote] = useState<QuoteDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [propinaCents, setPropinaCents] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (!tiendaId || lineas.length === 0) {
      setQuote(null);
      setError(null);
      return;
    }
    const mine = ++seq.current;
    setLoading(true);
    const timer = setTimeout(() => {
      api<QuoteDto>('/v1/carrito/cotizar', {
        token: null,
        body: { ubicacionId: tiendaId, modo, lineas, direccion: direccion ? { lat: direccion.lat, lng: direccion.lng } : undefined, propinaCents },
      })
        .then((q) => {
          if (mine === seq.current) {
            setQuote(q);
            setError(null);
          }
        })
        .catch((e: ApiError) => mine === seq.current && setError(e))
        .finally(() => mine === seq.current && setLoading(false));
    }, 150);
    return () => clearTimeout(timer);
  }, [tiendaId, modo, direccion, lineas, propinaCents]);

  const value = useMemo(() => ({ quote, loading, error, propinaCents, setPropinaCents }), [quote, loading, error, propinaCents]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useQuote(): QuoteCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useQuote fuera de QuoteProvider');
  return v;
}

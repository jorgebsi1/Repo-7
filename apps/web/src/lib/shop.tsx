'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { LineInput, Modo, Tienda } from './types';

export interface Direccion {
  linea: string;
  referencia?: string;
  lat: number;
  lng: number;
}

interface ShopCtx {
  tiendas: Tienda[];
  tiendaId: string | null;
  setTiendaId: (id: string) => void;
  modo: Modo;
  setModo: (m: Modo) => void;
  direccion: Direccion | null;
  setDireccion: (d: Direccion | null) => void;
  lineas: LineInput[];
  addLine: (l: LineInput) => void;
  setLines: (l: LineInput[]) => void;
  setQty: (index: number, l: LineInput) => void;
  removeLine: (index: number) => void;
  clear: () => void;
  count: number;
  ready: boolean;
}

const Ctx = createContext<ShopCtx | null>(null);
const KEY = 'prolac.shop';

interface Persisted {
  tiendaId: string | null;
  modo: Modo;
  direccion: Direccion | null;
  lineas: LineInput[];
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [tiendas, setTiendas] = useState<Tienda[]>([]);
  const [state, setState] = useState<Persisted>({ tiendaId: null, modo: 'RECOJO', direccion: null, lineas: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let saved: Partial<Persisted> = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Persisted>;
    } catch {
      /* se ignora */
    }
    api<Tienda[]>('/v1/ubicaciones', { token: null })
      .then((ts) => {
        setTiendas(ts);
        const valida = ts.find((t) => t.id === saved.tiendaId);
        setState({
          tiendaId: valida?.id ?? ts.find((t) => t.codigo === 'TRU-CAS')?.id ?? ts[0]?.id ?? null,
          modo: saved.modo ?? 'RECOJO',
          direccion: saved.direccion ?? null,
          lineas: valida ? (saved.lineas ?? []) : [],
        });
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* sin almacenamiento */
    }
  }, [state, ready]);

  const setTiendaId = useCallback((id: string) => setState((s) => (s.tiendaId === id ? s : { ...s, tiendaId: id, lineas: [] })), []);
  const setModo = useCallback((modo: Modo) => setState((s) => ({ ...s, modo })), []);
  const setDireccion = useCallback((direccion: Direccion | null) => setState((s) => ({ ...s, direccion })), []);
  const setLines = useCallback((lineas: LineInput[]) => setState((s) => ({ ...s, lineas })), []);
  const addLine = useCallback(
    (l: LineInput) =>
      setState((s) => {
        const i = s.lineas.findIndex((x) => x.skuId === l.skuId);
        if (i < 0) return { ...s, lineas: [...s.lineas, l] };
        const prev = s.lineas[i]!;
        const merged: LineInput = l.gramos !== undefined ? { skuId: l.skuId, gramos: (prev.gramos ?? 0) + l.gramos } : { skuId: l.skuId, cantidad: (prev.cantidad ?? 0) + (l.cantidad ?? 0) };
        return { ...s, lineas: s.lineas.map((x, j) => (j === i ? merged : x)) };
      }),
    [],
  );
  const setQty = useCallback((index: number, l: LineInput) => setState((s) => ({ ...s, lineas: s.lineas.map((x, i) => (i === index ? l : x)) })), []);
  const removeLine = useCallback((index: number) => setState((s) => ({ ...s, lineas: s.lineas.filter((_, i) => i !== index) })), []);
  const clear = useCallback(() => setState((s) => ({ ...s, lineas: [] })), []);

  const value = useMemo<ShopCtx>(
    () => ({
      tiendas,
      tiendaId: state.tiendaId,
      setTiendaId,
      modo: state.modo,
      setModo,
      direccion: state.direccion,
      setDireccion,
      lineas: state.lineas,
      addLine,
      setLines,
      setQty,
      removeLine,
      clear,
      count: state.lineas.length,
      ready,
    }),
    [tiendas, state, setTiendaId, setModo, setDireccion, addLine, setLines, setQty, removeLine, clear, ready],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShop(): ShopCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShop fuera de ShopProvider');
  return v;
}

/** Ubicación de ejemplo dentro de la zona de reparto demo (no hay mapa todavía). */
export const DIRECCION_DEMO: Direccion = { linea: 'Av. de ejemplo 123, Las Casuarinas', referencia: 'Dirección de prueba', lat: -8.133, lng: -79.03 };

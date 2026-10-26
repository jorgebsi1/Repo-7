'use client';

import { useEffect, useState } from 'react';

/** Cuenta regresiva de la ventana de frío (20 min desde que el repartidor sale). Verde → ámbar → rojo. */
export function ColdTimer({ limite, big = false }: { limite: string; big?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(limite).getTime() - now;
  const excedido = ms < 0;
  const abs = Math.abs(ms);
  const mm = String(Math.floor(abs / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((abs % 60_000) / 1000)).padStart(2, '0');
  const tono = excedido ? 'text-bad' : ms < 5 * 60_000 ? 'text-bad' : ms < 10 * 60_000 ? 'text-warn' : 'text-ok';
  return (
    <span role="timer" aria-label={excedido ? `Excedido por ${mm} minutos ${ss} segundos` : `Quedan ${mm} minutos ${ss} segundos`} className={`font-bold tabular-nums ${tono} ${big ? 'text-3xl' : 'text-base'}`}>
      {excedido ? `−${mm}:${ss}` : `${mm}:${ss}`}
      {excedido && <span className="ml-2 text-sm font-semibold">fuera de ventana</span>}
    </span>
  );
}

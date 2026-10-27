'use client';

import { useEffect, useState } from 'react';

/**
 * Cuenta regresiva de la META de viaje (20 min desde que el repartidor sale, en cooler).
 * Semáforo: verde dentro de la meta, ámbar "demorado" después. No hay nivel crítico ni alarma roja.
 */
export function ColdTimer({ limite, big = false }: { limite: string; big?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = new Date(limite).getTime() - now;
  const demorado = ms < 0;
  const abs = Math.abs(ms);
  const mm = String(Math.floor(abs / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((abs % 60_000) / 1000)).padStart(2, '0');
  return (
    <span
      role="timer"
      aria-label={demorado ? `Demorado por ${mm} minutos ${ss} segundos` : `Quedan ${mm} minutos ${ss} segundos de la meta`}
      className={`font-bold tabular-nums ${demorado ? 'text-warn' : 'text-ok'} ${big ? 'text-3xl' : 'text-base'}`}
    >
      {demorado ? `+${mm}:${ss}` : `${mm}:${ss}`}
      {demorado && <span className="ml-2 text-sm font-semibold">demorado</span>}
    </span>
  );
}

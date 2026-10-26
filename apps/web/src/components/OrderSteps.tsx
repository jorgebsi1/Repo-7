'use client';

import { Icon } from './ui';

/** Seguimiento por pasos (patrón de barra de progreso con estados). */
export function OrderSteps({ pasos, actual }: { pasos: string[]; actual: number }) {
  return (
    <ol className="flex items-start" aria-label="Progreso del pedido">
      {pasos.map((p, i) => {
        const done = i < actual;
        const current = i === actual;
        return (
          <li key={p} className="flex flex-1 flex-col items-center gap-1 text-center" aria-current={current ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <div className={`h-1 flex-1 ${i === 0 ? 'opacity-0' : done || current ? 'bg-brand' : 'bg-line'}`} />
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${done ? 'border-brand bg-brand text-white' : current ? 'border-brand bg-surface text-brand' : 'border-line bg-surface text-ink-soft'}`}>
                {done ? <Icon name="check" className="h-4 w-4" /> : i + 1}
              </div>
              <div className={`h-1 flex-1 ${i === pasos.length - 1 ? 'opacity-0' : done ? 'bg-brand' : 'bg-line'}`} />
            </div>
            <span className={`text-[11px] leading-tight ${current ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{p}</span>
          </li>
        );
      })}
    </ol>
  );
}

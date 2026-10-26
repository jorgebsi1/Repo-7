'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white active:bg-brand-strong disabled:opacity-50',
  secondary: 'bg-brand-soft text-brand-strong active:opacity-80 disabled:opacity-50',
  ghost: 'bg-transparent text-ink border border-line active:bg-muted disabled:opacity-50',
  danger: 'bg-bad text-white active:opacity-80 disabled:opacity-50',
};

export function Button({ variant = 'primary', block, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean }) {
  return (
    <button
      {...p}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-base font-semibold transition ${block ? 'w-full' : ''} ${VARIANT[variant]} ${className}`}
    />
  );
}

export function Chip({ active, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...p}
      className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition ${active ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink active:bg-muted'}`}
    >
      {children}
    </button>
  );
}

const TONO: Record<string, string> = {
  info: 'bg-brand-soft text-brand-strong',
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  neutral: 'bg-muted text-ink-soft',
};
export function Badge({ tono = 'neutral', children }: { tono?: keyof typeof TONO | string; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${TONO[tono] ?? TONO.neutral}`}>{children}</span>;
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, format }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; format?: (n: number) => string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-surface">
      <button aria-label="Disminuir" className="h-11 w-11 rounded-full text-xl font-semibold active:bg-muted disabled:opacity-30" disabled={value - step < min} onClick={() => onChange(value - step)}>
        −
      </button>
      <span className="min-w-16 text-center text-base font-semibold tabular-nums" aria-live="polite">
        {format ? format(value) : value}
      </span>
      <button aria-label="Aumentar" className="h-11 w-11 rounded-full text-xl font-semibold active:bg-muted disabled:opacity-30" disabled={value + step > max} onClick={() => onChange(value + step)}>
        +
      </button>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-surface ${className}`}>{children}</div>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-control border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
      {children}
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="text-5xl" aria-hidden>
        🥛
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="text-ink-soft">{text}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-line/60 ${className}`} />;
}

export function Icon({ name, className = 'h-6 w-6' }: { name: 'home' | 'search' | 'receipt' | 'user' | 'bag' | 'chevron' | 'store' | 'check' | 'back'; className?: string }) {
  const paths: Record<string, string> = {
    home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
    search: 'M11 4a7 7 0 1 0 4.2 12.6l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4z',
    receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
    bag: 'M6 8h12l1 12H5zM9 8a3 3 0 0 1 6 0',
    chevron: 'M9 6l6 6-6 6',
    store: 'M4 9l1-5h14l1 5M4 9v11h16V9M4 9a3 3 0 0 0 6 0 3 3 0 0 0 4 0 3 3 0 0 0 6 0',
    check: 'M5 12l5 5 9-10',
    back: 'M15 6l-6 6 6 6',
  };
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}

/** Marcador de imagen mientras no hay fotografía de producto (los acabados la traerán). */
export function ProductImage({ nombre, src, className = '' }: { nombre: string; src?: string | null; className?: string }) {
  if (src) return <img src={src} alt={nombre} className={`object-cover ${className}`} />;
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-brand-soft to-muted text-brand ${className}`} role="img" aria-label={`${nombre} (foto pendiente)`}>
      <svg viewBox="0 0 48 48" className="h-1/2 w-1/2 opacity-70" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M18 5h12v6l5 6v26H13V17l5-6z" />
        <path d="M13 24h22" />
      </svg>
    </div>
  );
}

/** Dinero siempre en céntimos enteros de sol (PEN). Nunca decimales flotantes. */
export type Cents = number;

export const MONEDA = 'PEN' as const;

export function assertCents(value: number, label = 'monto'): asserts value is Cents {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${label} debe ser un entero en céntimos, recibido ${value}`);
  }
}

/** Formato para mostrar: 1250 → "S/ 12.50". */
export function formatPEN(cents: Cents): string {
  assertCents(cents);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}S/ ${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

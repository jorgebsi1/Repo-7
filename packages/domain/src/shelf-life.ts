const MS_PER_DAY = 86_400_000;

/** Días (con decimales) que le quedan de vida útil a un lote en un instante dado. */
export function remainingShelfLifeDays(expiresAt: Date, at: Date): number {
  return (expiresAt.getTime() - at.getTime()) / MS_PER_DAY;
}

/**
 * ¿Es aceptable entregar este lote? El cliente debe recibirlo con al menos `minRemainingDays`
 * de vida útil. El mínimo es configurable (hipótesis a confirmar con el negocio).
 */
export function isAcceptableForDelivery(expiresAt: Date, deliverAt: Date, minRemainingDays: number): boolean {
  return remainingShelfLifeDays(expiresAt, deliverAt) >= minRemainingDays;
}

export interface BatchStock {
  loteId: string;
  expiresAt: Date;
  /** Unidades (packs) o gramos disponibles, según la modalidad del SKU. */
  disponible: number;
}

export interface Allocation {
  loteId: string;
  cantidad: number;
}

export interface AllocationResult {
  allocations: Allocation[];
  /** Lo que no se pudo cubrir (0 si todo se asignó). */
  faltante: number;
}

/**
 * Asigna cantidad a lotes con vencimiento más próximo primero (FEFO), descartando los que
 * no cumplen la vida útil mínima restante a la hora prevista de entrega.
 */
export function allocateFEFO(
  batches: readonly BatchStock[],
  cantidad: number,
  deliverAt: Date,
  minRemainingDays: number,
): AllocationResult {
  const usable = batches
    .filter((b) => b.disponible > 0 && isAcceptableForDelivery(b.expiresAt, deliverAt, minRemainingDays))
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  let pendiente = cantidad;
  const allocations: Allocation[] = [];
  for (const b of usable) {
    if (pendiente <= 0) break;
    const take = Math.min(b.disponible, pendiente);
    allocations.push({ loteId: b.loteId, cantidad: take });
    pendiente -= take;
  }
  return { allocations, faltante: Math.max(pendiente, 0) };
}

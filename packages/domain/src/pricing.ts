import { assertCents, type Cents } from './money.js';

/** Producto envasado con precio fijo por unidad (p. ej. envasado al vacío). */
export interface PackPricing {
  modalidad: 'PACK';
  precioCents: Cents;
}

/** Producto que se corta y pesa al momento de la compra. */
export interface PesoPricing {
  modalidad: 'PESO';
  precioKgCents: Cents;
  /** Incremento mínimo que el cliente puede pedir, en gramos (p. ej. 50). */
  pasoGramos: number;
  minGramos: number;
  maxGramos?: number;
}

export type SkuPricing = PackPricing | PesoPricing;

export type LineRequest =
  | { modalidad: 'PACK'; cantidad: number }
  | { modalidad: 'PESO'; gramos: number };

/** Margen con el que se autoriza el cobro de líneas por peso (el corte real puede pasarse un poco). */
export const DEFAULT_WEIGHT_MARGIN = 0.1;

export class PricingError extends Error {
  constructor(
    public readonly code:
      | 'MODALIDAD_INCOMPATIBLE'
      | 'CANTIDAD_INVALIDA'
      | 'PESO_INVALIDO'
      | 'EXCEDE_AUTORIZACION',
    message: string,
  ) {
    super(message);
  }
}

export function validateLineRequest(pricing: SkuPricing, req: LineRequest): void {
  if (pricing.modalidad !== req.modalidad) {
    throw new PricingError('MODALIDAD_INCOMPATIBLE', 'La modalidad de la línea no coincide con la del producto');
  }
  if (pricing.modalidad === 'PACK' && req.modalidad === 'PACK') {
    if (!Number.isInteger(req.cantidad) || req.cantidad < 1) {
      throw new PricingError('CANTIDAD_INVALIDA', 'La cantidad debe ser un entero mayor o igual a 1');
    }
  }
  if (pricing.modalidad === 'PESO' && req.modalidad === 'PESO') {
    const { gramos } = req;
    if (!Number.isInteger(gramos) || gramos < pricing.minGramos || gramos % pricing.pasoGramos !== 0) {
      throw new PricingError(
        'PESO_INVALIDO',
        `El peso debe ser múltiplo de ${pricing.pasoGramos} g y al menos ${pricing.minGramos} g`,
      );
    }
    if (pricing.maxGramos !== undefined && gramos > pricing.maxGramos) {
      throw new PricingError('PESO_INVALIDO', `El peso máximo por línea es ${pricing.maxGramos} g`);
    }
  }
}

export function weightPriceCents(precioKgCents: Cents, gramos: number): Cents {
  assertCents(precioKgCents, 'precio por kg');
  return Math.round((precioKgCents * gramos) / 1000);
}

/** Total estimado de una línea según lo que pidió el cliente. */
export function estimateLineCents(pricing: SkuPricing, req: LineRequest): Cents {
  validateLineRequest(pricing, req);
  if (pricing.modalidad === 'PACK' && req.modalidad === 'PACK') return pricing.precioCents * req.cantidad;
  if (pricing.modalidad === 'PESO' && req.modalidad === 'PESO') return weightPriceCents(pricing.precioKgCents, req.gramos);
  throw new PricingError('MODALIDAD_INCOMPATIBLE', 'Modalidad no soportada');
}

/** Monto que se autoriza: los packs exactos; las líneas por peso con margen hacia arriba. */
export function authorizedLineCents(
  pricing: SkuPricing,
  req: LineRequest,
  margin: number = DEFAULT_WEIGHT_MARGIN,
): Cents {
  const estimate = estimateLineCents(pricing, req);
  if (pricing.modalidad !== 'PESO') return estimate;
  // Aritmética entera (puntos básicos): 1440 × 1.10 en coma flotante da 1584.0000000000002 y subiría un céntimo.
  const bps = Math.round(margin * 10_000);
  return Math.ceil((estimate * (10_000 + bps)) / 10_000);
}

export interface WeighResult {
  finalCents: Cents;
  authorizedCents: Cents;
  /** final − estimado (negativo = el cliente paga menos). */
  deltaVsEstimateCents: Cents;
}

/** Resultado de pesar una línea en la tienda. Lanza si el peso real excede lo autorizado. */
export function weighLine(
  pricing: PesoPricing,
  requestedGrams: number,
  actualGrams: number,
  margin: number = DEFAULT_WEIGHT_MARGIN,
): WeighResult {
  if (!Number.isInteger(actualGrams) || actualGrams <= 0) {
    throw new PricingError('PESO_INVALIDO', 'El peso real debe ser un entero positivo en gramos');
  }
  const req: LineRequest = { modalidad: 'PESO', gramos: requestedGrams };
  const estimate = estimateLineCents(pricing, req);
  const authorizedCents = authorizedLineCents(pricing, req, margin);
  const finalCents = weightPriceCents(pricing.precioKgCents, actualGrams);
  if (finalCents > authorizedCents) {
    throw new PricingError(
      'EXCEDE_AUTORIZACION',
      'El peso real supera el margen autorizado; vuelve a cortar o pide confirmación al cliente',
    );
  }
  return { finalCents, authorizedCents, deltaVsEstimateCents: finalCents - estimate };
}

export interface OrderTotalsInput {
  /** Totales por línea ya resueltos (estimados, autorizados o finales según el caso). */
  lineCents: Cents[];
  deliveryFeeCents?: Cents;
  discountCents?: Cents;
  tipCents?: Cents;
}

export interface OrderTotals {
  subtotalCents: Cents;
  deliveryFeeCents: Cents;
  discountCents: Cents;
  tipCents: Cents;
  totalCents: Cents;
}

export function computeTotals(input: OrderTotalsInput): OrderTotals {
  const subtotalCents = input.lineCents.reduce((a, b) => a + b, 0);
  const deliveryFeeCents = input.deliveryFeeCents ?? 0;
  const discountCents = Math.min(input.discountCents ?? 0, subtotalCents);
  const tipCents = input.tipCents ?? 0;
  for (const [label, v] of Object.entries({ subtotalCents, deliveryFeeCents, discountCents, tipCents })) {
    assertCents(v, label);
  }
  return {
    subtotalCents,
    deliveryFeeCents,
    discountCents,
    tipCents,
    totalCents: subtotalCents - discountCents + deliveryFeeCents + tipCents,
  };
}

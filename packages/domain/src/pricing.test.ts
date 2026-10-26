import { describe, expect, it } from 'vitest';
import { formatPEN } from './money.js';
import { paymentEffect } from './payment-effects.js';
import {
  PricingError,
  authorizedLineCents,
  computeTotals,
  estimateLineCents,
  weighLine,
  type PackPricing,
  type PesoPricing,
} from './pricing.js';

const pack: PackPricing = { modalidad: 'PACK', precioCents: 1850 };
// Queso fresco: S/ 32.00 el kilo, pedido en pasos de 50 g, mínimo 200 g
const peso: PesoPricing = { modalidad: 'PESO', precioKgCents: 3200, pasoGramos: 50, minGramos: 200, maxGramos: 3000 };

describe('precios', () => {
  it('línea de pack = precio × cantidad', () => {
    expect(estimateLineCents(pack, { modalidad: 'PACK', cantidad: 3 })).toBe(5550);
  });

  it('línea por peso = precio/kg × gramos / 1000, redondeado', () => {
    expect(estimateLineCents(peso, { modalidad: 'PESO', gramos: 450 })).toBe(1440);
    expect(estimateLineCents({ ...peso, precioKgCents: 3333 }, { modalidad: 'PESO', gramos: 250 })).toBe(833);
  });

  it('rechaza pesos fuera de paso, bajo el mínimo o sobre el máximo', () => {
    for (const gramos of [175, 150, 3050]) {
      expect(() => estimateLineCents(peso, { modalidad: 'PESO', gramos })).toThrowError(PricingError);
    }
  });

  it('rechaza cantidades inválidas y modalidades cruzadas', () => {
    expect(() => estimateLineCents(pack, { modalidad: 'PACK', cantidad: 0 })).toThrowError(PricingError);
    expect(() => estimateLineCents(pack, { modalidad: 'PACK', cantidad: 1.5 })).toThrowError(PricingError);
    expect(() => estimateLineCents(pack, { modalidad: 'PESO', gramos: 200 })).toThrowError(PricingError);
  });

  it('autoriza packs exactos y pesos con 10 % de margen', () => {
    expect(authorizedLineCents(pack, { modalidad: 'PACK', cantidad: 2 })).toBe(3700);
    expect(authorizedLineCents(peso, { modalidad: 'PESO', gramos: 450 })).toBe(1584);
  });

  it('pesar: el peso real puede ser menor o algo mayor, dentro del margen', () => {
    const menos = weighLine(peso, 450, 430);
    expect(menos.finalCents).toBe(1376);
    expect(menos.deltaVsEstimateCents).toBe(-64);
    const mas = weighLine(peso, 450, 490);
    expect(mas.finalCents).toBe(1568);
    expect(mas.finalCents).toBeLessThanOrEqual(mas.authorizedCents);
  });

  it('pesar: exceder la autorización lanza EXCEDE_AUTORIZACION', () => {
    try {
      weighLine(peso, 450, 520);
      throw new Error('debió fallar');
    } catch (e) {
      expect((e as PricingError).code).toBe('EXCEDE_AUTORIZACION');
    }
  });

  it('totales: descuento acotado al subtotal y todo en céntimos enteros', () => {
    expect(computeTotals({ lineCents: [5550, 1440], deliveryFeeCents: 600, tipCents: 200, discountCents: 500 })).toEqual({
      subtotalCents: 6990,
      deliveryFeeCents: 600,
      discountCents: 500,
      tipCents: 200,
      totalCents: 7290,
    });
    expect(computeTotals({ lineCents: [300], discountCents: 1000 }).totalCents).toBe(0);
  });

  it('formatPEN', () => {
    expect(formatPEN(1250)).toBe('S/ 12.50');
    expect(formatPEN(5)).toBe('S/ 0.05');
    expect(() => formatPEN(12.5)).toThrow();
  });
});

describe('efectos de pago por transición', () => {
  const pay = { authorizedCents: 7000, capturedCents: 0, finalTotalCents: 6500 };

  it('captura el total final al empacar, nunca más de lo autorizado', () => {
    expect(paymentEffect('ALISTANDO', 'EMPACADO', pay)).toEqual({ type: 'capturar', amountCents: 6500 });
    expect(() => paymentEffect('ALISTANDO', 'EMPACADO', { ...pay, finalTotalCents: 7100 })).toThrow(RangeError);
  });

  it('cancelar antes de alistar anula la autorización', () => {
    expect(paymentEffect('CONFIRMADO', 'CANCELADO', pay)).toEqual({ type: 'anular_autorizacion' });
  });

  it('reembolso: devuelve lo capturado; si no hubo captura, anula la autorización', () => {
    expect(paymentEffect('FALLIDO_ENTREGA', 'REEMBOLSADO', { ...pay, capturedCents: 6500 })).toEqual({
      type: 'reembolsar',
      amountCents: 6500,
    });
    expect(paymentEffect('FALTANTE', 'REEMBOLSADO', pay)).toEqual({ type: 'anular_autorizacion' });
  });

  it('otras transiciones no mueven dinero', () => {
    expect(paymentEffect('CONFIRMADO', 'ALISTANDO', pay)).toEqual({ type: 'ninguno' });
  });
});

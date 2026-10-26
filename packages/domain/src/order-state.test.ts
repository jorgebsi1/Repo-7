import { describe, expect, it } from 'vitest';
import {
  ORDER_EVENTS,
  applyEvent,
  availableEvents,
  customerStepIndex,
  type Actor,
  type OrderEvent,
  type OrderStatus,
  type TransitionContext,
} from './order-state.js';

const entrega: TransitionContext = { mode: 'ENTREGA', allLinesResolved: true };
const recojo: TransitionContext = { mode: 'RECOJO', allLinesResolved: true };

/** Ejecuta una secuencia y devuelve el estado final; falla si alguna transición no es válida. */
function run(start: OrderStatus, steps: [OrderEvent, Actor][], ctx: TransitionContext): OrderStatus {
  let s = start;
  for (const [ev, actor] of steps) {
    const r = applyEvent(s, ev, actor, ctx);
    if (!r.ok) throw new Error(`${s} --${ev}/${actor}--> ${r.error}: ${r.message}`);
    s = r.to;
  }
  return s;
}

describe('máquina de estados del pedido', () => {
  it('ruta feliz de entrega a domicilio', () => {
    expect(
      run(
        'CREADO',
        [
          ['confirmar', 'cliente'],
          ['pago_autorizado', 'sistema'],
          ['iniciar_alistado', 'tienda'],
          ['empacar', 'tienda'],
          ['despachar', 'tienda'],
          ['entregar', 'repartidor'],
        ],
        entrega,
      ),
    ).toBe('ENTREGADO');
  });

  it('ruta feliz de recojo en tienda', () => {
    expect(
      run(
        'CREADO',
        [
          ['confirmar', 'cliente'],
          ['pago_autorizado', 'sistema'],
          ['iniciar_alistado', 'tienda'],
          ['empacar', 'tienda'],
          ['dejar_listo', 'tienda'],
          ['entregar', 'tienda'],
        ],
        recojo,
      ),
    ).toBe('ENTREGADO');
  });

  it('pago rechazado se puede reintentar y luego confirmar', () => {
    expect(
      run(
        'PAGO_PENDIENTE',
        [
          ['pago_rechazado', 'sistema'],
          ['reintentar_pago', 'cliente'],
          ['pago_autorizado', 'sistema'],
        ],
        entrega,
      ),
    ).toBe('CONFIRMADO');
  });

  it('pago fallido abandonado termina cancelado y se reembolsa (anula autorización)', () => {
    expect(
      run('PAGO_FALLIDO', [['abandonar', 'sistema'], ['reembolsar', 'sistema']], entrega),
    ).toBe('REEMBOLSADO');
  });

  it('faltante: se resuelve y el alistado continúa', () => {
    expect(
      run(
        'ALISTANDO',
        [
          ['reportar_faltante', 'tienda'],
          ['resolver_faltante', 'tienda'],
          ['empacar', 'tienda'],
        ],
        recojo,
      ),
    ).toBe('EMPACADO');
  });

  it('faltante total termina reembolsado', () => {
    expect(run('ALISTANDO', [['reportar_faltante', 'tienda'], ['reembolsar_por_faltante', 'tienda']], recojo)).toBe(
      'REEMBOLSADO',
    );
  });

  it('recojo no realizado: NO_RECOGIDO → REEMBOLSADO', () => {
    expect(run('LISTO_RECOJO', [['vencer_recojo', 'sistema'], ['reembolsar', 'sistema']], recojo)).toBe('REEMBOLSADO');
  });

  it('entrega fallida: FALLIDO_ENTREGA → REEMBOLSADO', () => {
    expect(run('EN_CAMINO', [['fallar_entrega', 'repartidor'], ['reembolsar', 'admin']], entrega)).toBe('REEMBOLSADO');
  });

  it('el cliente puede cancelar solo antes de que la tienda empiece a alistar', () => {
    expect(applyEvent('CONFIRMADO', 'cancelar', 'cliente', entrega)).toMatchObject({ ok: true, to: 'CANCELADO' });
    expect(applyEvent('ALISTANDO', 'cancelar', 'cliente', entrega)).toMatchObject({
      ok: false,
      error: 'EVENTO_NO_PERMITIDO_EN_ESTADO',
    });
  });

  it('no se puede empacar con líneas sin resolver', () => {
    const r = applyEvent('ALISTANDO', 'empacar', 'tienda', { mode: 'RECOJO', allLinesResolved: false });
    expect(r).toMatchObject({ ok: false, error: 'CONDICION_NO_CUMPLIDA' });
  });

  it('un pedido de recojo no se despacha y uno de entrega no queda "listo para recojo"', () => {
    expect(applyEvent('EMPACADO', 'despachar', 'tienda', recojo)).toMatchObject({ ok: false, error: 'CONDICION_NO_CUMPLIDA' });
    expect(applyEvent('EMPACADO', 'dejar_listo', 'tienda', entrega)).toMatchObject({ ok: false, error: 'CONDICION_NO_CUMPLIDA' });
  });

  it('solo el sistema autoriza pagos: el cliente no puede confirmar su propio pago', () => {
    expect(applyEvent('PAGO_PENDIENTE', 'pago_autorizado', 'cliente', entrega)).toMatchObject({
      ok: false,
      error: 'ACTOR_NO_AUTORIZADO',
    });
  });

  it('los estados terminales no admiten ningún evento', () => {
    for (const ev of ORDER_EVENTS) {
      for (const s of ['ENTREGADO', 'REEMBOLSADO'] as const) {
        expect(applyEvent(s, ev, 'admin', entrega)).toMatchObject({ ok: false, error: 'ESTADO_TERMINAL' });
      }
    }
  });

  it('availableEvents refleja lo que el panel puede ofrecer', () => {
    expect(availableEvents('CONFIRMADO', 'tienda', recojo)).toEqual(['iniciar_alistado', 'cancelar']);
    expect(availableEvents('CONFIRMADO', 'cliente', recojo)).toEqual(['cancelar']);
  });

  it('la barra de pasos del cliente avanza con el pedido', () => {
    expect(customerStepIndex('PAGO_PENDIENTE')).toBe(-1);
    expect(customerStepIndex('CONFIRMADO')).toBe(0);
    expect(customerStepIndex('FALTANTE')).toBe(1);
    expect(customerStepIndex('EN_CAMINO')).toBe(3);
    expect(customerStepIndex('ENTREGADO')).toBe(4);
  });
});

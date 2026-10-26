/**
 * Máquina de estados del pedido (docs/13 §4). Es la ÚNICA fuente de verdad sobre
 * qué transiciones existen; el módulo `orders` de la API es su único ejecutor.
 */
export const ORDER_STATUSES = [
  'CREADO',
  'PAGO_PENDIENTE',
  'PAGO_FALLIDO',
  'CONFIRMADO',
  'ALISTANDO',
  'FALTANTE',
  'EMPACADO',
  'LISTO_RECOJO',
  'EN_CAMINO',
  'ENTREGADO',
  'NO_RECOGIDO',
  'FALLIDO_ENTREGA',
  'CANCELADO',
  'REEMBOLSADO',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['ENTREGADO', 'REEMBOLSADO'];

export type Actor = 'cliente' | 'tienda' | 'repartidor' | 'sistema' | 'admin';
export type FulfillmentMode = 'RECOJO' | 'ENTREGA';

export const ORDER_EVENTS = [
  'confirmar',
  'pago_autorizado',
  'pago_rechazado',
  'reintentar_pago',
  'abandonar',
  'iniciar_alistado',
  'reportar_faltante',
  'resolver_faltante',
  'reembolsar_por_faltante',
  'empacar',
  'dejar_listo',
  'despachar',
  'entregar',
  'vencer_recojo',
  'fallar_entrega',
  'cancelar',
  'reembolsar',
] as const;
export type OrderEvent = (typeof ORDER_EVENTS)[number];

/** Datos mínimos del pedido que algunas transiciones necesitan para validarse. */
export interface TransitionContext {
  mode: FulfillmentMode;
  /** Todas las líneas están pesadas, contadas o marcadas como faltantes. */
  allLinesResolved?: boolean;
}

interface Rule {
  from: readonly OrderStatus[];
  to: OrderStatus;
  actors: readonly Actor[];
  guard?: (ctx: TransitionContext) => string | null;
}

const RULES: Record<OrderEvent, Rule[]> = {
  confirmar: [{ from: ['CREADO'], to: 'PAGO_PENDIENTE', actors: ['cliente', 'sistema'] }],
  pago_autorizado: [{ from: ['PAGO_PENDIENTE'], to: 'CONFIRMADO', actors: ['sistema'] }],
  pago_rechazado: [{ from: ['PAGO_PENDIENTE'], to: 'PAGO_FALLIDO', actors: ['sistema'] }],
  reintentar_pago: [{ from: ['PAGO_FALLIDO'], to: 'PAGO_PENDIENTE', actors: ['cliente'] }],
  abandonar: [{ from: ['PAGO_FALLIDO'], to: 'CANCELADO', actors: ['cliente', 'sistema'] }],
  iniciar_alistado: [{ from: ['CONFIRMADO'], to: 'ALISTANDO', actors: ['tienda', 'admin'] }],
  reportar_faltante: [{ from: ['ALISTANDO'], to: 'FALTANTE', actors: ['tienda', 'admin'] }],
  resolver_faltante: [{ from: ['FALTANTE'], to: 'ALISTANDO', actors: ['tienda', 'admin'] }],
  reembolsar_por_faltante: [{ from: ['FALTANTE'], to: 'REEMBOLSADO', actors: ['tienda', 'admin'] }],
  empacar: [
    {
      from: ['ALISTANDO'],
      to: 'EMPACADO',
      actors: ['tienda', 'admin'],
      guard: (ctx) => (ctx.allLinesResolved ? null : 'Hay líneas sin pesar, contar o marcar como faltantes'),
    },
  ],
  dejar_listo: [
    {
      from: ['EMPACADO'],
      to: 'LISTO_RECOJO',
      actors: ['tienda', 'admin'],
      guard: (ctx) => (ctx.mode === 'RECOJO' ? null : 'El pedido no es de recojo en tienda'),
    },
  ],
  despachar: [
    {
      from: ['EMPACADO'],
      to: 'EN_CAMINO',
      actors: ['tienda', 'repartidor', 'admin'],
      guard: (ctx) => (ctx.mode === 'ENTREGA' ? null : 'El pedido no es de entrega a domicilio'),
    },
  ],
  entregar: [
    { from: ['LISTO_RECOJO'], to: 'ENTREGADO', actors: ['tienda', 'admin'] },
    { from: ['EN_CAMINO'], to: 'ENTREGADO', actors: ['repartidor', 'tienda', 'admin'] },
  ],
  vencer_recojo: [{ from: ['LISTO_RECOJO'], to: 'NO_RECOGIDO', actors: ['sistema', 'tienda', 'admin'] }],
  fallar_entrega: [{ from: ['EN_CAMINO'], to: 'FALLIDO_ENTREGA', actors: ['repartidor', 'tienda', 'admin'] }],
  cancelar: [{ from: ['CONFIRMADO'], to: 'CANCELADO', actors: ['cliente', 'tienda', 'admin'] }],
  reembolsar: [
    { from: ['NO_RECOGIDO', 'FALLIDO_ENTREGA', 'CANCELADO'], to: 'REEMBOLSADO', actors: ['sistema', 'admin'] },
  ],
};

export type TransitionError =
  | 'EVENTO_NO_PERMITIDO_EN_ESTADO'
  | 'ACTOR_NO_AUTORIZADO'
  | 'CONDICION_NO_CUMPLIDA'
  | 'ESTADO_TERMINAL';

export type TransitionResult =
  | { ok: true; from: OrderStatus; to: OrderStatus }
  | { ok: false; error: TransitionError; message: string };

export function applyEvent(
  current: OrderStatus,
  event: OrderEvent,
  actor: Actor,
  ctx: TransitionContext,
): TransitionResult {
  if (TERMINAL_STATUSES.includes(current)) {
    return { ok: false, error: 'ESTADO_TERMINAL', message: `El pedido ya terminó en ${current}` };
  }
  const rule = RULES[event]?.find((r) => r.from.includes(current));
  if (!rule) {
    return { ok: false, error: 'EVENTO_NO_PERMITIDO_EN_ESTADO', message: `"${event}" no aplica en ${current}` };
  }
  if (!rule.actors.includes(actor)) {
    return { ok: false, error: 'ACTOR_NO_AUTORIZADO', message: `${actor} no puede ejecutar "${event}"` };
  }
  const blocked = rule.guard?.(ctx);
  if (blocked) {
    return { ok: false, error: 'CONDICION_NO_CUMPLIDA', message: blocked };
  }
  return { ok: true, from: current, to: rule.to };
}

/** Eventos que un actor podría intentar desde un estado (útil para habilitar botones en el panel). */
export function availableEvents(current: OrderStatus, actor: Actor, ctx: TransitionContext): OrderEvent[] {
  return ORDER_EVENTS.filter((e) => applyEvent(current, e, actor, ctx).ok);
}

/** Pasos visibles para el cliente en el seguimiento (patrón de barra de pasos). */
export const CUSTOMER_STEPS = ['Confirmado', 'Alistando', 'Empacado', 'En camino / Listo', 'Entregado'] as const;

export function customerStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'CREADO':
    case 'PAGO_PENDIENTE':
    case 'PAGO_FALLIDO':
      return -1;
    case 'CONFIRMADO':
      return 0;
    case 'ALISTANDO':
    case 'FALTANTE':
      return 1;
    case 'EMPACADO':
      return 2;
    case 'LISTO_RECOJO':
    case 'EN_CAMINO':
      return 3;
    case 'ENTREGADO':
      return 4;
    default:
      return -1; // cancelados, reembolsados, no recogidos: no avanzan en la barra
  }
}

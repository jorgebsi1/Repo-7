import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  bigint,
} from 'drizzle-orm/pg-core';
import { ORDER_STATUSES } from '@prolac/domain';

/** Dinero: siempre `integer` en céntimos de sol (PEN). Nunca decimales. */

export const ubicacionTipo = pgEnum('ubicacion_tipo', ['PLANTA', 'TIENDA']);
export const modalidadEnum = pgEnum('modalidad', ['PACK', 'PESO']);
export const estadoPedidoEnum = pgEnum('estado_pedido', ORDER_STATUSES);
export const modoEntregaEnum = pgEnum('modo_entrega', ['RECOJO', 'ENTREGA']);
export const estadoLineaEnum = pgEnum('estado_linea', ['PENDIENTE', 'LISTA', 'FALTANTE']);
export const estadoPagoEnum = pgEnum('estado_pago', ['AUTORIZADO', 'CAPTURADO', 'ANULADO', 'REEMBOLSADO', 'RECHAZADO']);
export const rolEnum = pgEnum('rol', ['cliente', 'tienda', 'repartidor', 'admin']);

const id = () => uuid('id').primaryKey().defaultRandom();
const creadoEn = () => timestamp('creado_en', { withTimezone: true }).notNull().defaultNow();

export const ubicacion = pgTable('ubicacion', {
  id: id(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  tipo: ubicacionTipo('tipo').notNull(),
  ciudad: text('ciudad').notNull(),
  direccion: text('direccion').notNull(),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  activo: boolean('activo').notNull().default(true),
  /** Solo las tiendas con esto en true aparecen en la app. */
  aceptaOnline: boolean('acepta_online').notNull().default(false),
  horario: jsonb('horario').$type<Record<string, string>>(),
  /** Reparto: la tienda cubre un radio máximo (hoy 4 km) con tarifa plana. */
  radioEntregaKm: doublePrecision('radio_entrega_km').notNull().default(4),
  tarifaEntregaCents: integer('tarifa_entrega_cents').notNull().default(600),
  envioGratisDesdeCents: integer('envio_gratis_desde_cents'),
  /** Marca los datos de muestra para no confundirlos con datos reales. */
  esDemo: boolean('es_demo').notNull().default(false),
});

export const categoria = pgTable('categoria', {
  id: id(),
  slug: text('slug').notNull().unique(),
  nombre: text('nombre').notNull(),
  orden: integer('orden').notNull().default(0),
});

export const producto = pgTable('producto', {
  id: id(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  categoriaId: uuid('categoria_id')
    .notNull()
    .references(() => categoria.id),
  registroSanitario: text('registro_sanitario'),
  /** Información exigida por las autoridades (nutricional, advertencias, alérgenos…). */
  etiquetado: jsonb('etiquetado').$type<Record<string, unknown>>(),
  vidaUtilDias: integer('vida_util_dias'),
  tempMinC: doublePrecision('temp_min_c').default(2),
  tempMaxC: doublePrecision('temp_max_c').default(4),
  imagenUrl: text('imagen_url'),
  activo: boolean('activo').notNull().default(true),
  esDemo: boolean('es_demo').notNull().default(false),
});

export const sku = pgTable(
  'sku',
  {
    id: id(),
    productoId: uuid('producto_id')
      .notNull()
      .references(() => producto.id),
    /** Código interno (aún no hay códigos de barras). */
    codigo: text('codigo').notNull().unique(),
    codigoBarras: text('codigo_barras'),
    presentacion: text('presentacion').notNull(),
    modalidad: modalidadEnum('modalidad').notNull(),
    /** Peso nominal del envase (PACK). */
    gramos: integer('gramos'),
    precioCents: integer('precio_cents'),
    precioKgCents: integer('precio_kg_cents'),
    pasoGramos: integer('paso_gramos'),
    minGramos: integer('min_gramos'),
    maxGramos: integer('max_gramos'),
    activo: boolean('activo').notNull().default(true),
  },
  (t) => [
    check(
      'sku_precio_segun_modalidad',
      sql`(${t.modalidad} = 'PACK' AND ${t.precioCents} IS NOT NULL) OR (${t.modalidad} = 'PESO' AND ${t.precioKgCents} IS NOT NULL AND ${t.pasoGramos} IS NOT NULL AND ${t.minGramos} IS NOT NULL)`,
    ),
    index('sku_producto_idx').on(t.productoId),
  ],
);

export const disponibilidadTienda = pgTable(
  'disponibilidad_tienda',
  {
    ubicacionId: uuid('ubicacion_id')
      .notNull()
      .references(() => ubicacion.id),
    skuId: uuid('sku_id')
      .notNull()
      .references(() => sku.id),
    disponible: boolean('disponible').notNull().default(true),
    /** Opcional: unidades (PACK) o gramos (PESO). Null = no se controla cantidad. */
    cantidad: numeric('cantidad', { mode: 'number' }),
    stockSeguridadOnline: numeric('stock_seguridad_online', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.ubicacionId, t.skuId] })],
);

export const lote = pgTable(
  'lote',
  {
    id: id(),
    ubicacionId: uuid('ubicacion_id')
      .notNull()
      .references(() => ubicacion.id),
    skuId: uuid('sku_id')
      .notNull()
      .references(() => sku.id),
    codigoLote: text('codigo_lote').notNull(),
    elaboradoEn: timestamp('elaborado_en', { withTimezone: true }).notNull(),
    venceEn: timestamp('vence_en', { withTimezone: true }).notNull(),
    cantidadInicial: numeric('cantidad_inicial', { mode: 'number' }).notNull(),
    cantidadDisponible: numeric('cantidad_disponible', { mode: 'number' }).notNull(),
  },
  (t) => [index('lote_ubicacion_sku_idx').on(t.ubicacionId, t.skuId, t.venceEn)],
);

export const cliente = pgTable('cliente', {
  id: id(),
  nombre: text('nombre').notNull(),
  telefono: text('telefono').notNull().unique(),
  email: text('email'),
  rol: rolEnum('rol').notNull().default('cliente'),
  /** Para personal de tienda: la tienda que atiende. */
  ubicacionId: uuid('ubicacion_id').references(() => ubicacion.id),
  creadoEn: creadoEn(),
});

export const direccion = pgTable('direccion', {
  id: id(),
  clienteId: uuid('cliente_id')
    .notNull()
    .references(() => cliente.id),
  etiqueta: text('etiqueta').notNull().default('Casa'),
  linea: text('linea').notNull(),
  referencia: text('referencia'),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
});

export const carrito = pgTable('carrito', {
  clienteId: uuid('cliente_id')
    .primaryKey()
    .references(() => cliente.id),
  ubicacionId: uuid('ubicacion_id').references(() => ubicacion.id),
  items: jsonb('items').$type<unknown[]>().notNull().default([]),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const pedido = pgTable(
  'pedido',
  {
    id: id(),
    numero: bigserial('numero', { mode: 'number' }).notNull(),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => cliente.id),
    ubicacionId: uuid('ubicacion_id')
      .notNull()
      .references(() => ubicacion.id),
    modo: modoEntregaEnum('modo').notNull(),
    estado: estadoPedidoEnum('estado').notNull().default('CREADO'),
    direccionSnapshot: jsonb('direccion_snapshot').$type<{ linea: string; referencia?: string; lat: number; lng: number }>(),
    franjaInicio: timestamp('franja_inicio', { withTimezone: true }),
    franjaFin: timestamp('franja_fin', { withTimezone: true }),
    subtotalEstimadoCents: integer('subtotal_estimado_cents').notNull(),
    tarifaEntregaCents: integer('tarifa_entrega_cents').notNull().default(0),
    descuentoCents: integer('descuento_cents').notNull().default(0),
    propinaCents: integer('propina_cents').notNull().default(0),
    totalEstimadoCents: integer('total_estimado_cents').notNull(),
    totalAutorizadoCents: integer('total_autorizado_cents').notNull(),
    totalFinalCents: integer('total_final_cents'),
    /** Hora aproximada de llegada que se le mostró al cliente (extremo superior del rango). Solo entregas. */
    entregaEstimadaEn: timestamp('entrega_estimada_en', { withTimezone: true }),
    notas: text('notas'),
    idempotencyKey: text('idempotency_key').notNull(),
    empacadoEn: timestamp('empacado_en', { withTimezone: true }),
    creadoEn: creadoEn(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('pedido_idem_idx').on(t.clienteId, t.idempotencyKey),
    index('pedido_estado_idx').on(t.ubicacionId, t.estado, t.creadoEn),
    index('pedido_cliente_idx').on(t.clienteId, t.creadoEn),
  ],
);

export const lineaPedido = pgTable(
  'linea_pedido',
  {
    id: id(),
    pedidoId: uuid('pedido_id')
      .notNull()
      .references(() => pedido.id),
    skuId: uuid('sku_id')
      .notNull()
      .references(() => sku.id),
    /** Snapshot: el pedido conserva lo que el cliente vio aunque cambien los precios. */
    nombre: text('nombre').notNull(),
    presentacion: text('presentacion').notNull(),
    modalidad: modalidadEnum('modalidad').notNull(),
    cantidad: integer('cantidad'),
    gramosSolicitados: integer('gramos_solicitados'),
    gramosFinales: integer('gramos_finales'),
    precioCents: integer('precio_cents'),
    precioKgCents: integer('precio_kg_cents'),
    estimadoCents: integer('estimado_cents').notNull(),
    autorizadoCents: integer('autorizado_cents').notNull(),
    finalCents: integer('final_cents'),
    estado: estadoLineaEnum('estado').notNull().default('PENDIENTE'),
    loteId: uuid('lote_id').references(() => lote.id),
    venceEn: timestamp('vence_en', { withTimezone: true }),
  },
  (t) => [index('linea_pedido_idx').on(t.pedidoId)],
);

export const reservaStock = pgTable(
  'reserva_stock',
  {
    id: id(),
    pedidoId: uuid('pedido_id')
      .notNull()
      .references(() => pedido.id),
    lineaId: uuid('linea_id').references(() => lineaPedido.id),
    ubicacionId: uuid('ubicacion_id')
      .notNull()
      .references(() => ubicacion.id),
    skuId: uuid('sku_id')
      .notNull()
      .references(() => sku.id),
    loteId: uuid('lote_id').references(() => lote.id),
    cantidad: numeric('cantidad', { mode: 'number' }).notNull(),
    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    confirmada: boolean('confirmada').notNull().default(false),
    liberada: boolean('liberada').notNull().default(false),
    consumida: boolean('consumida').notNull().default(false),
  },
  (t) => [index('reserva_sku_idx').on(t.ubicacionId, t.skuId), index('reserva_pedido_idx').on(t.pedidoId)],
);

export const pago = pgTable('pago', {
  id: id(),
  pedidoId: uuid('pedido_id')
    .notNull()
    .references(() => pedido.id),
  proveedor: text('proveedor').notNull(),
  referencia: text('referencia').notNull(),
  estado: estadoPagoEnum('estado').notNull(),
  autorizadoCents: integer('autorizado_cents').notNull(),
  capturadoCents: integer('capturado_cents').notNull().default(0),
  reembolsadoCents: integer('reembolsado_cents').notNull().default(0),
  creadoEn: creadoEn(),
});

export const entrega = pgTable('entrega', {
  id: id(),
  pedidoId: uuid('pedido_id')
    .notNull()
    .unique()
    .references(() => pedido.id),
  repartidorId: uuid('repartidor_id').references(() => cliente.id),
  despachadoEn: timestamp('despachado_en', { withTimezone: true }),
  entregadoEn: timestamp('entregado_en', { withTimezone: true }),
  /** Hora META de llegada: salida del repartidor + 20 min. */
  limiteFrioEn: timestamp('limite_frio_en', { withTimezone: true }),
  /** Se entregó después de la meta de 20 min (solo se registra para medir; no es una falla ni bloquea). */
  demorado: boolean('demorado').notNull().default(false),
});

/** Quién está de turno como repartidor y en qué tienda (la capacidad de reparto sale de aquí). */
export const repartidorTurno = pgTable('repartidor_turno', {
  repartidorId: uuid('repartidor_id')
    .primaryKey()
    .references(() => cliente.id),
  ubicacionId: uuid('ubicacion_id')
    .notNull()
    .references(() => ubicacion.id),
  enTurno: boolean('en_turno').notNull().default(false),
  desde: timestamp('desde', { withTimezone: true }).notNull().defaultNow(),
});

/** Solo se inserta, nunca se modifica ni se borra (auditoría). */
export const eventoPedido = pgTable(
  'evento_pedido',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    pedidoId: uuid('pedido_id')
      .notNull()
      .references(() => pedido.id),
    evento: text('evento').notNull(),
    de: estadoPedidoEnum('de'),
    a: estadoPedidoEnum('a'),
    actor: text('actor').notNull(),
    actorId: uuid('actor_id'),
    detalle: jsonb('detalle').$type<Record<string, unknown>>(),
    creadoEn: creadoEn(),
  },
  (t) => [index('evento_pedido_idx').on(t.pedidoId, t.id)],
);

export const schema = {
  ubicacion,
  categoria,
  producto,
  sku,
  disponibilidadTienda,
  lote,
  cliente,
  direccion,
  repartidorTurno,
  carrito,
  pedido,
  lineaPedido,
  reservaStock,
  pago,
  entrega,
  eventoPedido,
};

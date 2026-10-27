import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { Subject } from 'rxjs';
import { z } from 'zod';
import {
  CUSTOMER_STEPS,
  applyEvent,
  availableEvents,
  coldChainDeadline,
  coldChainStatus,
  computeTotals,
  customerStepIndex,
  paymentEffect,
  pickCourier,
  type Actor,
  type OrderEvent,
  type OrderStatus,
} from '@prolac/domain';
import type { AuthUser } from '../../common/auth';
import { BUSINESS_CONFIG, CLOCK, DB, PAYMENT_PROVIDER, type BusinessConfig, type Clock } from '../../common/tokens';
import { conflict, notFound } from '../../common/errors';
import type { Db, Tx } from '../../db/client';
import { cliente, entrega, eventoPedido, lineaPedido, pago, pedido, ubicacion } from '../../db/schema';
import { DeliveryService } from '../delivery/delivery.service';
import { CartService, lineInputSchema, quoteSchema, type PricedLine } from '../cart/cart.service';
import { InventoryService, StockShortage } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { PaymentProvider } from '../payments/payment.provider';

export type PedidoRow = typeof pedido.$inferSelect;
export type LineaRow = typeof lineaPedido.$inferSelect;

export const createOrderSchema = quoteSchema
  .omit({ direccion: true })
  .extend({
    direccion: z
      .object({ linea: z.string().min(3).max(200), referencia: z.string().max(200).optional(), lat: z.number(), lng: z.number() })
      .optional(),
    franja: z.object({ inicio: z.string().datetime(), fin: z.string().datetime() }).optional(),
    notas: z.string().max(300).optional(),
    pago: z.object({ token: z.string().max(200).optional() }).default({}),
  });
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export interface OrderBusEvent {
  pedidoId: string;
  numero: number;
  clienteId: string;
  ubicacionId: string;
  estado: OrderStatus;
  evento: string;
}

const toActor = (user: AuthUser): Actor => user.rol;

@Injectable()
export class OrdersService {
  /** Canal de eventos para SSE (seguimiento del cliente y tablero de la tienda). */
  readonly bus = new Subject<OrderBusEvent>();

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BUSINESS_CONFIG) private readonly cfg: BusinessConfig,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    private readonly cart: CartService,
    private readonly inventory: InventoryService,
    private readonly notifications: NotificationsService,
    private readonly delivery: DeliveryService,
  ) {}

  // ───────────────────────── creación ─────────────────────────

  async create(user: AuthUser, input: CreateOrderInput, idempotencyKey: string | undefined) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUERIDA', message: 'Envía la cabecera Idempotency-Key (8 a 100 caracteres)' });
    }
    const previo = await this.findByKey(user.id, idempotencyKey);
    if (previo) return { reutilizado: true, pedido: await this.detail(previo.id, user) };

    const quote = await this.cart.quote({
      ubicacionId: input.ubicacionId,
      modo: input.modo,
      lineas: input.lineas,
      direccion: input.direccion ? { lat: input.direccion.lat, lng: input.direccion.lng } : undefined,
      propinaCents: input.propinaCents,
    });
    if (quote.problemas.length) throw conflict('PRODUCTO_NO_DISPONIBLE', 'Hay productos no disponibles en esta tienda', { problemas: quote.problemas });
    if (input.modo === 'ENTREGA') {
      if (!input.direccion) throw new BadRequestException({ code: 'DIRECCION_REQUERIDA', message: 'Indica la dirección de entrega' });
      if (quote.entrega && !quote.entrega.ok) {
        throw conflict(quote.entrega.reason, 'Esa dirección está fuera de nuestra cobertura de entrega');
      }
    }

    const now = this.clock.now();
    const deliverAt = input.franja ? new Date(input.franja.inicio) : new Date(now.getTime() + this.cfg.defaultLeadMinutes * 60_000);

    let pedidoId: string;
    try {
      pedidoId = await this.db.transaction(async (tx) => {
        const [p] = await tx
          .insert(pedido)
          .values({
            clienteId: user.id,
            ubicacionId: quote.ubicacionId,
            modo: input.modo,
            direccionSnapshot: input.direccion ?? null,
            franjaInicio: input.franja ? new Date(input.franja.inicio) : null,
            franjaFin: input.franja ? new Date(input.franja.fin) : null,
            subtotalEstimadoCents: quote.subtotalCents,
            tarifaEntregaCents: quote.tarifaEntregaCents,
            propinaCents: quote.propinaCents,
            totalEstimadoCents: quote.totalEstimadoCents,
            totalAutorizadoCents: quote.totalAutorizadoCents,
            entregaEstimadaEn: quote.entregaEstimada ? new Date(now.getTime() + quote.entregaEstimada.maxMin * 60_000) : null,
            notas: input.notas ?? null,
            idempotencyKey,
            creadoEn: now,
            actualizadoEn: now,
          })
          .returning();
        const lineas = await tx
          .insert(lineaPedido)
          .values(quote.lineas.map((l) => this.lineValues(p!.id, l)))
          .returning();
        await this.inventory.reserve(tx, {
          pedidoId: p!.id,
          ubicacionId: quote.ubicacionId,
          lines: lineas.map((l) => ({ lineaId: l.id, skuId: l.skuId, cantidad: l.modalidad === 'PACK' ? l.cantidad! : l.gramosSolicitados! })),
          deliverAt,
          now,
        });
        await tx.insert(eventoPedido).values({ pedidoId: p!.id, evento: 'crear', a: 'CREADO', actor: 'cliente', actorId: user.id, detalle: { lineas: lineas.length } });
        return p!.id;
      });
    } catch (e) {
      if (e instanceof StockShortage) throw conflict('SIN_STOCK', 'Algunos productos ya no tienen stock suficiente', { lineas: e.lineas });
      if ((e as { code?: string }).code === '23505') {
        const dup = await this.findByKey(user.id, idempotencyKey);
        if (dup) return { reutilizado: true, pedido: await this.detail(dup.id, user) };
      }
      throw e;
    }

    await this.transition(pedidoId, 'confirmar', 'cliente', user.id);
    await this.authorizePayment(pedidoId, user.id, input.pago.token);
    return { reutilizado: false, pedido: await this.detail(pedidoId, user) };
  }

  private lineValues(pedidoId: string, l: PricedLine): typeof lineaPedido.$inferInsert {
    return {
      pedidoId,
      skuId: l.skuId,
      nombre: l.nombre,
      presentacion: l.presentacion,
      modalidad: l.modalidad,
      cantidad: l.cantidad,
      gramosSolicitados: l.gramos,
      precioCents: l.precioCents,
      precioKgCents: l.precioKgCents,
      estimadoCents: l.estimadoCents,
      autorizadoCents: l.autorizadoCents,
    };
  }

  private async findByKey(clienteId: string, key: string) {
    const [p] = await this.db.select().from(pedido).where(and(eq(pedido.clienteId, clienteId), eq(pedido.idempotencyKey, key)));
    return p;
  }

  /** Autoriza el pago del pedido y avanza a CONFIRMADO o PAGO_FALLIDO. */
  private async authorizePayment(pedidoId: string, clienteId: string, token: string | undefined) {
    const [p] = await this.db.select().from(pedido).where(eq(pedido.id, pedidoId));
    if (!p) throw notFound('El pedido');
    const res = await this.payments.authorize({ amountCents: p.totalAutorizadoCents, token, orderRef: String(p.numero) });
    const [existing] = await this.db.select().from(pago).where(eq(pago.pedidoId, pedidoId));
    if (res.ok) {
      const values = { proveedor: this.payments.name, referencia: res.reference, estado: 'AUTORIZADO' as const, autorizadoCents: p.totalAutorizadoCents };
      if (existing) await this.db.update(pago).set(values).where(eq(pago.id, existing.id));
      else await this.db.insert(pago).values({ pedidoId, ...values });
      await this.transition(pedidoId, 'pago_autorizado', 'sistema', null);
    } else {
      const values = { proveedor: this.payments.name, referencia: res.reason, estado: 'RECHAZADO' as const, autorizadoCents: 0 };
      if (existing) await this.db.update(pago).set(values).where(eq(pago.id, existing.id));
      else await this.db.insert(pago).values({ pedidoId, ...values });
      await this.transition(pedidoId, 'pago_rechazado', 'sistema', null, { motivo: res.reason });
    }
    void clienteId;
  }

  async retryPayment(user: AuthUser, pedidoId: string, token: string | undefined) {
    const p = await this.loadForUser(pedidoId, user);
    if (p.estado !== 'PAGO_FALLIDO') {
      throw conflict('EVENTO_NO_PERMITIDO_EN_ESTADO', `No se puede reintentar el pago en estado ${p.estado}`, { estado: p.estado });
    }
    // La reserva original pudo caducar mientras el cliente decidía: se vuelve a apartar el stock.
    const now = this.clock.now();
    const lineas = await this.db.select().from(lineaPedido).where(eq(lineaPedido.pedidoId, p.id));
    try {
      await this.db.transaction(async (tx) => {
        await this.inventory.release(tx, p.id);
        await this.inventory.reserve(tx, {
          pedidoId: p.id,
          ubicacionId: p.ubicacionId,
          lines: lineas.map((l) => ({ lineaId: l.id, skuId: l.skuId, cantidad: l.modalidad === 'PACK' ? l.cantidad! : l.gramosSolicitados! })),
          deliverAt: p.franjaInicio ?? new Date(now.getTime() + this.cfg.defaultLeadMinutes * 60_000),
          now,
        });
      });
    } catch (e) {
      if (e instanceof StockShortage) throw conflict('SIN_STOCK', 'Algunos productos ya no tienen stock suficiente', { lineas: e.lineas });
      throw e;
    }
    await this.transition(p.id, 'reintentar_pago', toActor(user), user.id);
    await this.authorizePayment(p.id, user.id, token);
    return this.detail(p.id, user);
  }

  // ───────────────────────── transiciones ─────────────────────────

  /**
   * ÚNICO punto que cambia el estado de un pedido. Valida con la máquina de estados del dominio,
   * aplica los efectos (stock, pagos, entrega), registra el evento y avisa por el bus.
   */
  async transition(pedidoId: string, event: OrderEvent, actor: Actor, actorId: string | null, detalle: Record<string, unknown> = {}): Promise<PedidoRow> {
    const result = await this.db.transaction(async (tx) => {
      const [p] = await tx.select().from(pedido).where(eq(pedido.id, pedidoId)).for('update');
      if (!p) throw notFound('El pedido');
      const lineas = await tx.select().from(lineaPedido).where(eq(lineaPedido.pedidoId, pedidoId));
      const ctx = { mode: p.modo, allLinesResolved: lineas.length > 0 && lineas.every((l) => l.estado !== 'PENDIENTE') };
      const r = applyEvent(p.estado, event, actor, ctx);
      if (!r.ok) {
        // Quien no tiene permiso para el evento recibe 403; el resto son conflictos de estado (409).
        if (r.error === 'ACTOR_NO_AUTORIZADO') throw new ForbiddenException({ code: r.error, message: r.message });
        throw conflict(r.error, r.message, { estado: p.estado, evento: event });
      }
      const now = this.clock.now();
      const fields = await this.applyEffects(tx, p, lineas, r.to, now, actorId, actor, detalle);
      const [updated] = await tx
        .update(pedido)
        .set({ estado: r.to, actualizadoEn: now, ...fields })
        .where(eq(pedido.id, pedidoId))
        .returning();
      await tx.insert(eventoPedido).values({ pedidoId, evento: event, de: p.estado, a: r.to, actor, actorId, detalle });
      return { pedido: updated!, from: p.estado, to: r.to };
    });
    this.afterCommit(result.pedido, event, result.to, detalle);
    // Cancelar o abandonar no deja dinero retenido: el reembolso (o anulación) es automático.
    if (result.to === 'CANCELADO') {
      return this.transition(pedidoId, 'reembolsar', 'sistema', null, { automatico: true });
    }
    return result.pedido;
  }

  private async applyEffects(
    tx: Tx,
    p: PedidoRow,
    lineas: LineaRow[],
    to: OrderStatus,
    now: Date,
    actorId: string | null,
    actor: Actor,
    detalle: Record<string, unknown>,
  ): Promise<Partial<typeof pedido.$inferInsert>> {
    const from = p.estado;
    const [pg] = await tx.select().from(pago).where(eq(pago.pedidoId, p.id));
    const hayAutorizacion = !!pg && pg.estado !== 'RECHAZADO' && pg.estado !== 'ANULADO';

    switch (to) {
      case 'CONFIRMADO':
        await this.inventory.confirm(tx, p.id);
        return {};

      case 'EMPACADO': {
        const finales = lineas.map((l) => (l.estado === 'FALTANTE' ? 0 : (l.finalCents ?? 0)));
        const totals = computeTotals({
          lineCents: finales,
          deliveryFeeCents: p.tarifaEntregaCents,
          discountCents: p.descuentoCents,
          tipCents: p.propinaCents,
        });
        if (totals.subtotalCents === 0) throw conflict('SIN_LINEAS_VALIDAS', 'Todas las líneas están como faltantes; reembolsa el pedido');
        for (const l of lineas) {
          if (l.estado === 'FALTANTE') await this.inventory.release(tx, p.id, l.id);
          else await this.inventory.consumeLine(tx, p.id, l.id, l.modalidad === 'PACK' ? l.cantidad! : l.gramosFinales!);
        }
        if (pg && hayAutorizacion) {
          const eff = paymentEffect(from, to, { authorizedCents: pg.autorizadoCents, capturedCents: pg.capturadoCents, finalTotalCents: totals.totalCents });
          if (eff.type === 'capturar') {
            await this.payments.capture(pg.referencia, eff.amountCents);
            await tx.update(pago).set({ estado: 'CAPTURADO', capturadoCents: eff.amountCents }).where(eq(pago.id, pg.id));
          }
        }
        // El reloj de frío (20 min) NO arranca al empacar sino cuando el repartidor sale (EN_CAMINO).
        if (p.modo === 'ENTREGA') await tx.insert(entrega).values({ pedidoId: p.id }).onConflictDoNothing();
        return { totalFinalCents: totals.totalCents, empacadoEn: now };
      }

      case 'EN_CAMINO': {
        // Quien sale: el propio repartidor si se asigna él, o el menos cargado de los que están de turno.
        let repartidorId: string | null = actor === 'repartidor' ? actorId : null;
        if (!repartidorId) {
          const couriers = await this.delivery.courierLoads(tx, p.ubicacionId);
          // Nunca se bloquea la salida: se asigna al menos cargado y, si nadie está de turno, sale sin
          // repartidor asignado (lo entrega la tienda). La carga se refleja en el tiempo estimado, no en un rechazo.
          repartidorId = pickCourier(couriers)?.id ?? null;
        }
        const limite = coldChainDeadline(now, this.cfg.idealTripMinutes);
        await tx.update(entrega).set({ despachadoEn: now, repartidorId, limiteFrioEn: limite }).where(eq(entrega.pedidoId, p.id));
        detalle.repartidorId = repartidorId;
        detalle.limiteFrioEn = limite.toISOString();
        return {};
      }

      case 'ENTREGADO': {
        const [en] = await tx.select().from(entrega).where(eq(entrega.pedidoId, p.id));
        const demorado = !!en?.despachadoEn && coldChainStatus(en.despachadoEn, now, this.cfg.idealTripMinutes).demorado;
        await tx.update(entrega).set({ entregadoEn: now, demorado }).where(eq(entrega.pedidoId, p.id));
        if (en?.despachadoEn) detalle.demorado = demorado;
        return {};
      }

      case 'CANCELADO':
        await this.inventory.release(tx, p.id);
        if (from === 'CONFIRMADO' && pg && hayAutorizacion) {
          const eff = paymentEffect(from, to, { authorizedCents: pg.autorizadoCents, capturedCents: pg.capturadoCents, finalTotalCents: 0 });
          if (eff.type === 'anular_autorizacion') {
            await this.payments.void(pg.referencia);
            await tx.update(pago).set({ estado: 'ANULADO' }).where(eq(pago.id, pg.id));
          }
        }
        return {};

      case 'REEMBOLSADO': {
        await this.inventory.release(tx, p.id);
        if (pg && hayAutorizacion) {
          const eff = paymentEffect(from, to, { authorizedCents: pg.autorizadoCents, capturedCents: pg.capturadoCents, finalTotalCents: 0 });
          if (eff.type === 'reembolsar') {
            await this.payments.refund(pg.referencia, eff.amountCents);
            await tx.update(pago).set({ estado: 'REEMBOLSADO', reembolsadoCents: eff.amountCents }).where(eq(pago.id, pg.id));
          } else if (eff.type === 'anular_autorizacion') {
            await this.payments.void(pg.referencia);
            await tx.update(pago).set({ estado: 'ANULADO' }).where(eq(pago.id, pg.id));
          }
        }
        return {};
      }

      default:
        return {};
    }
  }

  private afterCommit(p: PedidoRow, event: OrderEvent, to: OrderStatus, detalle: Record<string, unknown>) {
    this.bus.next({ pedidoId: p.id, numero: p.numero, clienteId: p.clienteId, ubicacionId: p.ubicacionId, estado: to, evento: event });
    const plantilla: Partial<Record<OrderStatus, string>> = {
      CONFIRMADO: 'pedido_confirmado',
      FALTANTE: 'pedido_con_faltante',
      EMPACADO: 'pedido_empacado',
      LISTO_RECOJO: 'pedido_listo_para_recojo',
      EN_CAMINO: 'pedido_en_camino',
      ENTREGADO: 'pedido_entregado',
      NO_RECOGIDO: 'pedido_no_recogido',
      FALLIDO_ENTREGA: 'entrega_fallida',
      PAGO_FALLIDO: 'pago_rechazado',
      REEMBOLSADO: 'pedido_reembolsado',
    };
    const t = plantilla[to];
    if (t) this.notifications.notify(p.clienteId, t, { numero: p.numero });
    if (detalle.demorado === true) this.notifications.notify(p.clienteId, 'entrega_demorada', { numero: p.numero });
  }

  // ───────────────────────── consultas ─────────────────────────

  async loadForUser(pedidoId: string, user: AuthUser): Promise<PedidoRow> {
    const [p] = await this.db.select().from(pedido).where(eq(pedido.id, pedidoId));
    if (!p) throw notFound('El pedido');
    this.assertCanView(user, p);
    return p;
  }

  assertCanView(user: AuthUser, p: PedidoRow) {
    const ok =
      user.rol === 'admin' ||
      (user.rol === 'cliente' && p.clienteId === user.id) ||
      (user.rol === 'tienda' && p.ubicacionId === user.ubicacionId) ||
      (user.rol === 'repartidor' && p.modo === 'ENTREGA' && p.ubicacionId === user.ubicacionId);
    // Se responde "no existe" para no revelar pedidos ajenos.
    if (!ok) throw notFound('El pedido');
  }

  /** Quien opera (tienda/repartidor/admin) no puede tocar pedidos de otra tienda. */
  assertCanOperate(user: AuthUser, p: PedidoRow) {
    if (user.rol === 'cliente') throw new ForbiddenException({ code: 'ROL_NO_PERMITIDO', message: 'No tienes permiso para esta acción' });
    this.assertCanView(user, p);
  }

  async detail(pedidoId: string, user: AuthUser) {
    const p = await this.loadForUser(pedidoId, user);
    const [lineas, [pg], [en], eventos, [u], [c]] = await Promise.all([
      this.db.select().from(lineaPedido).where(eq(lineaPedido.pedidoId, p.id)),
      this.db.select().from(pago).where(eq(pago.pedidoId, p.id)),
      this.db.select().from(entrega).where(eq(entrega.pedidoId, p.id)),
      this.db.select().from(eventoPedido).where(eq(eventoPedido.pedidoId, p.id)).orderBy(eventoPedido.id),
      this.db.select().from(ubicacion).where(eq(ubicacion.id, p.ubicacionId)),
      this.db.select({ nombre: cliente.nombre, telefono: cliente.telefono }).from(cliente).where(eq(cliente.id, p.clienteId)),
    ]);
    const ctx = { mode: p.modo, allLinesResolved: lineas.length > 0 && lineas.every((l) => l.estado !== 'PENDIENTE') };
    return {
      id: p.id,
      numero: p.numero,
      estado: p.estado,
      modo: p.modo,
      tienda: u ? { id: u.id, nombre: u.nombre, ciudad: u.ciudad } : null,
      cliente: user.rol === 'cliente' ? undefined : c,
      direccion: p.direccionSnapshot,
      franja: p.franjaInicio ? { inicio: p.franjaInicio, fin: p.franjaFin } : null,
      /** Hora aproximada de llegada que se le prometió al cliente (solo entregas). */
      entregaEstimadaEn: p.entregaEstimadaEn,
      notas: p.notas,
      totales: {
        subtotalEstimadoCents: p.subtotalEstimadoCents,
        tarifaEntregaCents: p.tarifaEntregaCents,
        descuentoCents: p.descuentoCents,
        propinaCents: p.propinaCents,
        totalEstimadoCents: p.totalEstimadoCents,
        totalAutorizadoCents: p.totalAutorizadoCents,
        totalFinalCents: p.totalFinalCents,
      },
      lineas: lineas.map((l) => ({
        id: l.id,
        skuId: l.skuId,
        nombre: l.nombre,
        presentacion: l.presentacion,
        modalidad: l.modalidad,
        cantidad: l.cantidad,
        gramosSolicitados: l.gramosSolicitados,
        gramosFinales: l.gramosFinales,
        estimadoCents: l.estimadoCents,
        finalCents: l.finalCents,
        estado: l.estado,
      })),
      pago: pg ? { estado: pg.estado, proveedor: pg.proveedor, autorizadoCents: pg.autorizadoCents, capturadoCents: pg.capturadoCents, reembolsadoCents: pg.reembolsadoCents, motivo: pg.estado === 'RECHAZADO' ? pg.referencia : undefined } : null,
      entrega: en ? await this.entregaDto(en) : null,
      pasos: CUSTOMER_STEPS,
      pasoActual: customerStepIndex(p.estado),
      acciones: user.rol === 'cliente' ? availableEvents(p.estado, 'cliente', ctx) : availableEvents(p.estado, toActor(user), ctx),
      eventos: eventos.map((e) => ({ evento: e.evento, de: e.de, a: e.a, actor: e.actor, en: e.creadoEn, detalle: e.detalle })),
      creadoEn: p.creadoEn,
    };
  }

  private async entregaDto(en: typeof entrega.$inferSelect) {
    const st = en.despachadoEn && !en.entregadoEn ? coldChainStatus(en.despachadoEn, this.clock.now(), this.cfg.idealTripMinutes) : null;
    const [r] = en.repartidorId ? await this.db.select({ nombre: cliente.nombre }).from(cliente).where(eq(cliente.id, en.repartidorId)) : [];
    return {
      repartidor: r?.nombre ?? null,
      despachadoEn: en.despachadoEn,
      entregadoEn: en.entregadoEn,
      limiteFrioEn: en.limiteFrioEn,
      /** Ya entregado: lo registrado. En camino: si ya pasó la meta de 20 min (solo semáforo ámbar, sin bloqueo). */
      demorado: en.entregadoEn ? en.demorado : (st?.demorado ?? false),
      minutosRestantes: st?.minutosRestantes ?? null,
      nivel: st?.nivel ?? null,
    };
  }

  /** Historial del cliente. */
  async listMine(user: AuthUser) {
    const rows = await this.db.select().from(pedido).where(eq(pedido.clienteId, user.id)).orderBy(desc(pedido.creadoEn)).limit(50);
    return this.summaries(rows);
  }

  /** Tablero de la tienda (o todas, si es admin). */
  async listForStore(user: AuthUser, estados?: OrderStatus[]) {
    const where = and(
      user.rol === 'tienda' ? eq(pedido.ubicacionId, user.ubicacionId ?? '') : undefined,
      estados?.length ? inArray(pedido.estado, estados) : undefined,
    );
    const rows = await this.db.select().from(pedido).where(where).orderBy(desc(pedido.creadoEn)).limit(100);
    return this.summaries(rows);
  }

  private async summaries(rows: PedidoRow[]) {
    if (!rows.length) return [];
    const lineas = await this.db.select().from(lineaPedido).where(inArray(lineaPedido.pedidoId, rows.map((r) => r.id)));
    const clientes = await this.db.select({ id: cliente.id, nombre: cliente.nombre }).from(cliente).where(inArray(cliente.id, [...new Set(rows.map((r) => r.clienteId))]));
    return rows.map((r) => {
      const ls = lineas.filter((l) => l.pedidoId === r.id);
      return {
        id: r.id,
        numero: r.numero,
        estado: r.estado,
        modo: r.modo,
        cliente: clientes.find((c) => c.id === r.clienteId)?.nombre ?? '',
        lineas: ls.length,
        pendientes: ls.filter((l) => l.estado === 'PENDIENTE').length,
        resumen: ls.slice(0, 3).map((l) => `${l.nombre} (${l.presentacion})`),
        totalEstimadoCents: r.totalEstimadoCents,
        totalFinalCents: r.totalFinalCents,
        pasoActual: customerStepIndex(r.estado),
        creadoEn: r.creadoEn,
      };
    });
  }

  /** "Volver a pedir": rearma el carrito con la disponibilidad y precios de hoy. */
  async reorder(user: AuthUser, pedidoId: string) {
    const p = await this.loadForUser(pedidoId, user);
    const lineas = await this.db.select().from(lineaPedido).where(eq(lineaPedido.pedidoId, p.id));
    const input = lineas.map((l) => lineInputSchema.parse(l.modalidad === 'PACK' ? { skuId: l.skuId, cantidad: l.cantidad! } : { skuId: l.skuId, gramos: l.gramosSolicitados! }));
    const dir = p.direccionSnapshot;
    return this.cart.quote({
      ubicacionId: p.ubicacionId,
      modo: p.modo,
      lineas: input,
      direccion: dir ? { lat: dir.lat, lng: dir.lng } : undefined,
      propinaCents: p.propinaCents,
    });
  }

  async cancel(user: AuthUser, pedidoId: string) {
    const p = await this.loadForUser(pedidoId, user);
    // Si el pago falló, "cancelar" significa abandonar el intento.
    await this.transition(p.id, p.estado === 'PAGO_FALLIDO' ? 'abandonar' : 'cancelar', toActor(user), user.id);
    return this.detail(p.id, user);
  }
}

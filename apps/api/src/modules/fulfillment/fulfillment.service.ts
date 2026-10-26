import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { PricingError, weighLine, type Actor, type OrderEvent } from '@prolac/domain';
import type { AuthUser } from '../../common/auth';
import { BUSINESS_CONFIG, CLOCK, DB, type BusinessConfig, type Clock } from '../../common/tokens';
import { conflict, notFound } from '../../common/errors';
import type { Db } from '../../db/client';
import { eventoPedido, lineaPedido } from '../../db/schema';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';

/** Acciones de la tienda (alistado, pesaje, empaque, despacho) → eventos de la máquina de estados. */
export const STORE_ACTIONS: Record<string, OrderEvent> = {
  'iniciar-alistado': 'iniciar_alistado',
  'resolver-faltante': 'resolver_faltante',
  'reembolsar-por-faltante': 'reembolsar_por_faltante',
  empacar: 'empacar',
  'dejar-listo': 'dejar_listo',
  despachar: 'despachar',
  entregar: 'entregar',
  'vencer-recojo': 'vencer_recojo',
  'fallar-entrega': 'fallar_entrega',
  reembolsar: 'reembolsar',
};

@Injectable()
export class FulfillmentService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BUSINESS_CONFIG) private readonly cfg: BusinessConfig,
    private readonly orders: OrdersService,
    private readonly inventory: InventoryService,
  ) {}

  async act(user: AuthUser, pedidoId: string, action: string) {
    const event = STORE_ACTIONS[action];
    if (!event) throw notFound('La acción');
    const p = await this.orders.loadForUser(pedidoId, user);
    this.orders.assertCanOperate(user, p);
    await this.orders.transition(p.id, event, user.rol as Actor, user.id);
    return this.orders.detail(p.id, user);
  }

  private async loadLine(user: AuthUser, pedidoId: string, lineaId: string) {
    const p = await this.orders.loadForUser(pedidoId, user);
    this.orders.assertCanOperate(user, p);
    const [l] = await this.db.select().from(lineaPedido).where(and(eq(lineaPedido.id, lineaId), eq(lineaPedido.pedidoId, pedidoId)));
    if (!l) throw notFound('La línea');
    return { p, l };
  }

  private note(pedidoId: string, evento: string, user: AuthUser, detalle: Record<string, unknown>) {
    return this.db.insert(eventoPedido).values({ pedidoId, evento, actor: user.rol, actorId: user.id, detalle });
  }

  private ping(pedidoId: string, numero: number, clienteId: string, ubicacionId: string, estado: Parameters<OrdersService['bus']['next']>[0]['estado'], evento: string) {
    this.orders.bus.next({ pedidoId, numero, clienteId, ubicacionId, estado, evento });
  }

  /** Producto envasado verificado y puesto en la bolsa. */
  async confirmLine(user: AuthUser, pedidoId: string, lineaId: string) {
    const { p, l } = await this.loadLine(user, pedidoId, lineaId);
    if (p.estado !== 'ALISTANDO') throw conflict('EVENTO_NO_PERMITIDO_EN_ESTADO', `No se puede alistar en estado ${p.estado}`, { estado: p.estado });
    if (l.modalidad !== 'PACK') throw conflict('MODALIDAD_INCOMPATIBLE', 'Esta línea es por peso: usa "pesar"');
    if (l.estado === 'FALTANTE') throw conflict('LINEA_FALTANTE', 'La línea fue marcada como faltante');
    await this.db.update(lineaPedido).set({ estado: 'LISTA', finalCents: l.estimadoCents }).where(eq(lineaPedido.id, l.id));
    await this.note(p.id, 'linea_confirmada', user, { lineaId });
    this.ping(p.id, p.numero, p.clienteId, p.ubicacionId, p.estado, 'linea_confirmada');
    return this.orders.detail(p.id, user);
  }

  /** Producto cortado y pesado: el cobro final sale del peso real. */
  async weighLine(user: AuthUser, pedidoId: string, lineaId: string, gramosReales: number) {
    const { p, l } = await this.loadLine(user, pedidoId, lineaId);
    if (p.estado !== 'ALISTANDO') throw conflict('EVENTO_NO_PERMITIDO_EN_ESTADO', `No se puede pesar en estado ${p.estado}`, { estado: p.estado });
    if (l.modalidad !== 'PESO') throw conflict('MODALIDAD_INCOMPATIBLE', 'Esta línea es un producto envasado: usa "confirmar"');
    if (l.estado === 'FALTANTE') throw conflict('LINEA_FALTANTE', 'La línea fue marcada como faltante');
    try {
      const r = weighLine(
        { modalidad: 'PESO', precioKgCents: l.precioKgCents!, pasoGramos: 1, minGramos: 1 },
        l.gramosSolicitados!,
        gramosReales,
        this.cfg.weightMargin,
      );
      await this.db
        .update(lineaPedido)
        .set({ estado: 'LISTA', gramosFinales: gramosReales, finalCents: r.finalCents })
        .where(eq(lineaPedido.id, l.id));
      await this.note(p.id, 'linea_pesada', user, { lineaId, gramosSolicitados: l.gramosSolicitados, gramosReales, finalCents: r.finalCents, diferenciaCents: r.deltaVsEstimateCents });
      this.ping(p.id, p.numero, p.clienteId, p.ubicacionId, p.estado, 'linea_pesada');
    } catch (e) {
      if (e instanceof PricingError) {
        throw e.code === 'EXCEDE_AUTORIZACION'
          ? conflict(e.code, e.message, { gramosSolicitados: l.gramosSolicitados })
          : new BadRequestException({ code: e.code, message: e.message });
      }
      throw e;
    }
    return this.orders.detail(p.id, user);
  }

  /** No hay producto suficiente: se descarta la línea y el pedido pasa a FALTANTE hasta que la tienda decida. */
  async markMissing(user: AuthUser, pedidoId: string, lineaId: string, motivo?: string) {
    const { p, l } = await this.loadLine(user, pedidoId, lineaId);
    if (p.estado !== 'ALISTANDO' && p.estado !== 'FALTANTE') {
      throw conflict('EVENTO_NO_PERMITIDO_EN_ESTADO', `No se puede marcar faltante en estado ${p.estado}`, { estado: p.estado });
    }
    await this.db.transaction(async (tx) => {
      await tx.update(lineaPedido).set({ estado: 'FALTANTE', finalCents: 0, gramosFinales: null }).where(eq(lineaPedido.id, l.id));
      await this.inventory.release(tx, p.id, l.id);
    });
    await this.note(p.id, 'linea_faltante', user, { lineaId, motivo: motivo ?? null });
    if (p.estado === 'ALISTANDO') await this.orders.transition(p.id, 'reportar_faltante', user.rol as Actor, user.id, { lineaId, motivo: motivo ?? null });
    else this.ping(p.id, p.numero, p.clienteId, p.ubicacionId, p.estado, 'linea_faltante');
    return this.orders.detail(p.id, user);
  }

  async setAvailability(user: AuthUser, skuId: string, disponible: boolean) {
    if (!user.ubicacionId) throw new BadRequestException({ code: 'TIENDA_REQUERIDA', message: 'Tu usuario no está asignado a una tienda' });
    await this.inventory.setDisponible(user.ubicacionId, skuId, disponible);
    return { skuId, disponible };
  }
}

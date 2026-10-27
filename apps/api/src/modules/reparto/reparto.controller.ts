import { BadRequestException, Body, Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { coldChainStatus } from '@prolac/domain';
import type { AuthUser } from '../../common/auth';
import { AuthGuard, CurrentUser, Roles } from '../../common/auth.guard';
import { BUSINESS_CONFIG, CLOCK, DB, type BusinessConfig, type Clock } from '../../common/tokens';
import { parse } from '../../common/zod';
import type { Db } from '../../db/client';
import { cliente, entrega, lineaPedido, pedido } from '../../db/schema';
import { DeliveryService } from '../delivery/delivery.service';

const turnoSchema = z.object({ enTurno: z.boolean() });

/** Vista del repartidor: su turno, lo que puede recoger para salir y lo que lleva en ruta con la cuenta de frío. */
@ApiTags('reparto')
@Controller('v1/reparto')
@UseGuards(AuthGuard)
@Roles('repartidor', 'admin')
export class RepartoController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(BUSINESS_CONFIG) private readonly cfg: BusinessConfig,
    private readonly delivery: DeliveryService,
  ) {}

  @Get('pedidos')
  async mine(@CurrentUser() user: AuthUser) {
    const now = this.clock.now();
    const enTurno = await this.delivery.enTurno(user.id);
    const baseSel = { p: pedido, e: entrega, cliente: cliente.nombre, telefono: cliente.telefono };

    const enRutaRows = await this.db
      .select(baseSel)
      .from(pedido)
      .innerJoin(entrega, eq(entrega.pedidoId, pedido.id))
      .innerJoin(cliente, eq(cliente.id, pedido.clienteId))
      .where(and(eq(entrega.repartidorId, user.id), eq(pedido.estado, 'EN_CAMINO')))
      .orderBy(entrega.limiteFrioEn);

    const porSalirRows = user.ubicacionId
      ? await this.db
          .select(baseSel)
          .from(pedido)
          .innerJoin(entrega, eq(entrega.pedidoId, pedido.id))
          .innerJoin(cliente, eq(cliente.id, pedido.clienteId))
          .where(and(eq(pedido.ubicacionId, user.ubicacionId), eq(pedido.estado, 'EMPACADO'), eq(pedido.modo, 'ENTREGA')))
          .orderBy(desc(pedido.empacadoEn))
      : [];

    const ids = [...enRutaRows, ...porSalirRows].map((r) => r.p.id);
    const lineas = ids.length ? await this.db.select().from(lineaPedido).where(inArray(lineaPedido.pedidoId, ids)) : [];
    const card = (r: (typeof enRutaRows)[number]) => {
      const st = r.e.despachadoEn ? coldChainStatus(r.e.despachadoEn, now, this.cfg.idealTripMinutes) : null;
      return {
        id: r.p.id,
        numero: r.p.numero,
        estado: r.p.estado,
        cliente: r.cliente,
        telefono: r.telefono,
        direccion: r.p.direccionSnapshot,
        resumen: lineas.filter((l) => l.pedidoId === r.p.id && l.estado !== 'FALTANTE').map((l) => `${l.nombre.replace('[DEMO] ', '')} (${l.presentacion})`),
        totalFinalCents: r.p.totalFinalCents,
        limiteFrioEn: st?.limite ?? null,
        minutosRestantes: st?.minutosRestantes ?? null,
        demorado: st?.demorado ?? false,
      };
    };
    return { enTurno, metaViajeMin: this.cfg.idealTripMinutes, enRuta: enRutaRows.map(card), porSalir: porSalirRows.map(card) };
  }

  @Post('turno')
  async turno(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const b = parse(turnoSchema, body);
    if (!user.ubicacionId) throw new BadRequestException({ code: 'TIENDA_REQUERIDA', message: 'Tu usuario no está asignado a una tienda' });
    await this.delivery.setTurno(user.id, user.ubicacionId, b.enTurno);
    return { enTurno: b.enTurno };
  }
}

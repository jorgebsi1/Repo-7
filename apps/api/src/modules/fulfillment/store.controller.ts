import { Body, Controller, Get, MessageEvent, Param, ParseUUIDPipe, Patch, Post, Query, Sse, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Observable, filter, map } from 'rxjs';
import { z } from 'zod';
import { ORDER_STATUSES, type OrderStatus } from '@prolac/domain';
import type { AuthUser } from '../../common/auth';
import { AuthGuard, CurrentUser, Roles } from '../../common/auth.guard';
import { BadRequestException } from '@nestjs/common';
import { parse } from '../../common/zod';
import { CatalogService } from '../catalog/catalog.service';
import { OrdersService } from '../orders/orders.service';
import { FulfillmentService } from './fulfillment.service';

const weighSchema = z.object({ gramosReales: z.number().int().positive().max(20_000) });
const missingSchema = z.object({ motivo: z.string().max(200).optional() });
const availabilitySchema = z.object({ disponible: z.boolean() });

/** Panel de tienda: tablero, alistado, pesaje, empaque y despacho. */
@ApiTags('tienda')
@Controller('v1/tienda')
@UseGuards(AuthGuard)
@Roles('tienda', 'admin', 'repartidor')
export class StoreController {
  constructor(
    private readonly orders: OrdersService,
    private readonly fulfillment: FulfillmentService,
    private readonly catalog: CatalogService,
  ) {}

  @Get('pedidos')
  @Roles('tienda', 'admin')
  list(@CurrentUser() user: AuthUser, @Query('estado') estado?: string) {
    const estados = estado ? estado.split(',').map((e) => e.trim()) : undefined;
    const invalid = estados?.filter((e) => !(ORDER_STATUSES as readonly string[]).includes(e));
    if (invalid?.length) throw new BadRequestException({ code: 'ESTADO_INVALIDO', message: `Estados inválidos: ${invalid.join(', ')}` });
    return this.orders.listForStore(user, estados as OrderStatus[] | undefined);
  }

  @Get('pedidos/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id, user);
  }

  @Post('pedidos/:id/lineas/:lineaId/confirmar')
  @Roles('tienda', 'admin')
  confirmLine(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('lineaId', ParseUUIDPipe) lineaId: string) {
    return this.fulfillment.confirmLine(user, id, lineaId);
  }

  @Post('pedidos/:id/lineas/:lineaId/pesar')
  @Roles('tienda', 'admin')
  weigh(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('lineaId', ParseUUIDPipe) lineaId: string, @Body() body: unknown) {
    return this.fulfillment.weighLine(user, id, lineaId, parse(weighSchema, body).gramosReales);
  }

  @Post('pedidos/:id/lineas/:lineaId/faltante')
  @Roles('tienda', 'admin')
  missing(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('lineaId', ParseUUIDPipe) lineaId: string, @Body() body: unknown) {
    return this.fulfillment.markMissing(user, id, lineaId, parse(missingSchema, body ?? {}).motivo);
  }

  /** Acciones del pedido: iniciar-alistado, resolver-faltante, reembolsar-por-faltante, empacar, dejar-listo, despachar, entregar, vencer-recojo, fallar-entrega, reembolsar, cancelar. */
  @Post('pedidos/:id/:accion')
  act(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('accion') accion: string) {
    return this.fulfillment.act(user, id, accion);
  }

  /** Catálogo de la tienda del usuario, con disponibilidad, para gestionar agotados. */
  @Get('catalogo')
  @Roles('tienda')
  async ownCatalog(@CurrentUser() user: AuthUser) {
    if (!user.ubicacionId) throw new BadRequestException({ code: 'TIENDA_REQUERIDA', message: 'Tu usuario no está asignado a una tienda' });
    return this.catalog.catalogo(user.ubicacionId);
  }

  @Patch('disponibilidad/:skuId')
  @Roles('tienda')
  availability(@CurrentUser() user: AuthUser, @Param('skuId', ParseUUIDPipe) skuId: string, @Body() body: unknown) {
    return this.fulfillment.setAvailability(user, skuId, parse(availabilitySchema, body).disponible);
  }

  /** Cambios de cualquier pedido de la tienda, en vivo (SSE). */
  @Sse('stream')
  @Roles('tienda', 'admin')
  stream(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.orders.bus.pipe(
      filter((e) => user.rol === 'admin' || e.ubicacionId === user.ubicacionId),
      map((e) => ({ data: { pedidoId: e.pedidoId, numero: e.numero, estado: e.estado, evento: e.evento } })),
    );
  }
}

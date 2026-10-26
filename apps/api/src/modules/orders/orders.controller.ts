import { Body, Controller, Get, Headers, MessageEvent, Param, ParseUUIDPipe, Post, Sse, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Observable, filter, map } from 'rxjs';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth';
import { AuthGuard, CurrentUser, Roles } from '../../common/auth.guard';
import { parse } from '../../common/zod';
import { OrdersService, createOrderSchema } from './orders.service';

const retrySchema = z.object({ token: z.string().max(200).optional() });

@ApiTags('pedidos')
@Controller('v1/pedidos')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Crea el pedido, reserva stock y autoriza el pago. Requiere la cabecera Idempotency-Key. */
  @Post()
  @Roles('cliente')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @Headers('idempotency-key') key?: string) {
    return this.orders.create(user, parse(createOrderSchema, body), key);
  }

  @Get()
  @Roles('cliente')
  mine(@CurrentUser() user: AuthUser) {
    return this.orders.listMine(user);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id, user);
  }

  /** Eventos en vivo del pedido (SSE). Como EventSource no envía cabeceras, acepta ?token=. */
  @Sse(':id/stream')
  async stream(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<Observable<MessageEvent>> {
    await this.orders.loadForUser(id, user); // valida permiso antes de abrir el canal
    return this.orders.bus.pipe(
      filter((e) => e.pedidoId === id),
      map((e) => ({ data: { estado: e.estado, evento: e.evento } })),
    );
  }

  @Post(':id/cancelar')
  @Roles('cliente')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.cancel(user, id);
  }

  @Post(':id/reintentar-pago')
  @Roles('cliente')
  retry(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.orders.retryPayment(user, id, parse(retrySchema, body ?? {}).token);
  }

  /** "Volver a pedir": devuelve la cotización de hoy con los mismos productos. */
  @Post(':id/reordenar')
  @Roles('cliente')
  reorder(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.reorder(user, id);
  }
}

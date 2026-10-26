import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../../common/auth';
import { AuthGuard, CurrentUser } from '../../common/auth.guard';
import { parse } from '../../common/zod';
import { CartService, lineInputSchema, quoteSchema } from './cart.service';

const saveSchema = z.object({ ubicacionId: z.string().uuid().nullable(), items: z.array(lineInputSchema).max(60) });

@ApiTags('carrito')
@Controller('v1/carrito')
export class CartController {
  constructor(private readonly cart: CartService) {}

  /** Calcula precios, disponibilidad y tarifa de entrega. No requiere sesión (sirve para el carrito de invitado). */
  @Post('cotizar')
  cotizar(@Body() body: unknown) {
    return this.cart.quote(parse(quoteSchema, body));
  }

  @Get()
  @UseGuards(AuthGuard)
  saved(@CurrentUser() user: AuthUser) {
    return this.cart.getSaved(user.id);
  }

  @Put()
  @UseGuards(AuthGuard)
  save(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const b = parse(saveSchema, body);
    return this.cart.save(user.id, b.ubicacionId, b.items);
  }
}

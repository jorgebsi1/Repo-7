import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parse } from '../../common/zod';
import { DeliveryService } from './delivery.service';

const resolverSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  subtotalCents: z.number().int().min(0),
});

@ApiTags('entrega')
@Controller('v1/entrega')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  /** ¿Qué tienda atiende esta dirección y a qué costo? (la más cercana dentro de su radio de 4 km). */
  @Post('resolver')
  resolver(@Body() body: unknown) {
    const b = parse(resolverSchema, body);
    return this.delivery.resolver([b.lng, b.lat], b.subtotalCents);
  }
}

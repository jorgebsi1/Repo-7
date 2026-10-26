import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parse } from '../../common/zod';
import { DeliveryService } from './delivery.service';

const cotizarSchema = z.object({
  ubicacionId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  subtotalCents: z.number().int().min(0),
});

@ApiTags('entrega')
@Controller('v1/entrega')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post('cotizar')
  cotizar(@Body() body: unknown) {
    const b = parse(cotizarSchema, body);
    return this.delivery.cotizar(b.ubicacionId, [b.lng, b.lat], b.subtotalCents);
  }
}

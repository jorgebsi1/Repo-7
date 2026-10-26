import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { quoteDelivery, type DeliveryQuote, type DeliveryZone, type LngLat } from '@prolac/domain';
import type { Db } from '../../db/client';
import { zonaReparto } from '../../db/schema';
import { DB } from '../../common/tokens';

@Injectable()
export class DeliveryService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async zonas(ubicacionId: string): Promise<DeliveryZone[]> {
    const rows = await this.db.select().from(zonaReparto).where(eq(zonaReparto.ubicacionId, ubicacionId));
    return rows.map((z) => ({
      id: z.id,
      ubicacionId: z.ubicacionId,
      nombre: z.nombre,
      poligono: z.poligono,
      tarifaCents: z.tarifaCents,
      pedidoMinimoCents: z.pedidoMinimoCents,
      envioGratisDesdeCents: z.envioGratisDesdeCents ?? undefined,
    }));
  }

  async cotizar(ubicacionId: string, punto: LngLat, subtotalCents: number): Promise<DeliveryQuote> {
    return quoteDelivery(await this.zonas(ubicacionId), ubicacionId, punto, subtotalCents);
  }
}

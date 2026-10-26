import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { categoria, producto, sku, ubicacion } from '../../db/schema';
import { CLOCK, DB, type Clock } from '../../common/tokens';
import { notFound } from '../../common/errors';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly inventory: InventoryService,
  ) {}

  /** Tiendas que venden en línea (las únicas visibles en la app). */
  async ubicaciones() {
    return this.db
      .select({
        id: ubicacion.id,
        codigo: ubicacion.codigo,
        nombre: ubicacion.nombre,
        ciudad: ubicacion.ciudad,
        direccion: ubicacion.direccion,
        lat: ubicacion.lat,
        lng: ubicacion.lng,
        horario: ubicacion.horario,
        esDemo: ubicacion.esDemo,
      })
      .from(ubicacion)
      .where(and(eq(ubicacion.tipo, 'TIENDA'), eq(ubicacion.activo, true), eq(ubicacion.aceptaOnline, true)))
      .orderBy(asc(ubicacion.ciudad), asc(ubicacion.nombre));
  }

  private async tiendaOnline(ubicacionId: string) {
    const [u] = await this.db.select().from(ubicacion).where(eq(ubicacion.id, ubicacionId));
    if (!u || u.tipo !== 'TIENDA' || !u.activo || !u.aceptaOnline) throw notFound('La tienda');
    return u;
  }

  async catalogo(ubicacionId: string) {
    const tienda = await this.tiendaOnline(ubicacionId);
    const [cats, prods, skus] = await Promise.all([
      this.db.select().from(categoria).orderBy(asc(categoria.orden)),
      this.db.select().from(producto).where(eq(producto.activo, true)),
      this.db.select().from(sku).where(eq(sku.activo, true)),
    ]);
    const disp = await this.inventory.availability(ubicacionId, skus.map((s) => s.id), this.clock.now());
    const skuDto = (s: (typeof skus)[number]) => ({
      id: s.id,
      codigo: s.codigo,
      presentacion: s.presentacion,
      modalidad: s.modalidad,
      gramos: s.gramos,
      precioCents: s.precioCents,
      precioKgCents: s.precioKgCents,
      pasoGramos: s.pasoGramos,
      minGramos: s.minGramos,
      maxGramos: s.maxGramos,
      disponible: disp.get(s.id)?.disponible ?? false,
      venceEn: disp.get(s.id)?.venceEn ?? null,
    });
    const productoDto = (p: (typeof prods)[number]) => ({
      id: p.id,
      codigo: p.codigo,
      nombre: p.nombre,
      descripcion: p.descripcion,
      imagenUrl: p.imagenUrl,
      registroSanitario: p.registroSanitario,
      etiquetado: p.etiquetado,
      vidaUtilDias: p.vidaUtilDias,
      conservacion: { minC: p.tempMinC, maxC: p.tempMaxC },
      skus: skus.filter((s) => s.productoId === p.id).map(skuDto),
    });
    return {
      tienda: { id: tienda.id, nombre: tienda.nombre, ciudad: tienda.ciudad },
      categorias: cats
        .map((c) => ({
          id: c.id,
          slug: c.slug,
          nombre: c.nombre,
          productos: prods.filter((p) => p.categoriaId === c.id).map(productoDto).filter((p) => p.skus.length > 0),
        }))
        .filter((c) => c.productos.length > 0),
    };
  }

  async producto(id: string, ubicacionId?: string) {
    const [p] = await this.db.select().from(producto).where(eq(producto.id, id));
    if (!p) throw notFound('El producto');
    const skus = await this.db.select().from(sku).where(and(eq(sku.productoId, id), eq(sku.activo, true)));
    const disp = ubicacionId
      ? await this.inventory.availability(ubicacionId, skus.map((s) => s.id), this.clock.now())
      : new Map();
    const [cat] = await this.db.select().from(categoria).where(inArray(categoria.id, [p.categoriaId]));
    return {
      ...p,
      categoria: cat ? { slug: cat.slug, nombre: cat.nombre } : null,
      skus: skus.map((s) => ({ ...s, disponible: disp.get(s.id)?.disponible ?? null, venceEn: disp.get(s.id)?.venceEn ?? null })),
    };
  }
}

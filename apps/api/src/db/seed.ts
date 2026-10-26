import type { Db } from './client';
import { DEMO_CATEGORIAS, DEMO_PRODUCTOS, DEMO_UBICACIONES, DEMO_USUARIOS, DEMO_ZONA } from './seed-data';
import {
  categoria,
  cliente,
  disponibilidadTienda,
  lote,
  producto,
  sku,
  ubicacion,
  zonaReparto,
} from './schema';

const DAY = 86_400_000;

export async function isEmpty(db: Db): Promise<boolean> {
  const rows = await db.select({ id: ubicacion.id }).from(ubicacion).limit(1);
  return rows.length === 0;
}

/** Inserta los datos de muestra (ficticios). Idempotente solo si la base está vacía. */
export async function seedDemo(db: Db, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const ubic = await tx.insert(ubicacion).values(DEMO_UBICACIONES.map((u) => ({ ...u, esDemo: true }))).returning();
    const ubicPorCodigo = new Map(ubic.map((u) => [u.codigo, u]));

    const cats = await tx.insert(categoria).values([...DEMO_CATEGORIAS]).returning();
    const catPorSlug = new Map(cats.map((c) => [c.slug, c.id]));

    const tiendasOnline = ubic.filter((u) => u.tipo === 'TIENDA' && u.aceptaOnline);

    for (const p of DEMO_PRODUCTOS) {
      const [prod] = await tx
        .insert(producto)
        .values({
          codigo: p.codigo,
          nombre: p.nombre,
          descripcion: p.descripcion,
          categoriaId: catPorSlug.get(p.categoria)!,
          vidaUtilDias: p.vidaUtilDias,
          registroSanitario: 'PENDIENTE — cargar número real',
          etiquetado: { nota: 'Etiquetado de muestra; cargar el real exigido por las autoridades' },
          esDemo: true,
        })
        .returning();
      const skus = await tx
        .insert(sku)
        .values(p.skus.map((s) => ({ ...s, productoId: prod!.id })))
        .returning();
      for (const s of skus) {
        for (const t of tiendasOnline) {
          await tx.insert(disponibilidadTienda).values({
            ubicacionId: t.id,
            skuId: s.id,
            disponible: true,
            cantidad: null, // stock perenne: no se controla cantidad en el esqueleto
          });
          // Un lote de muestra por SKU y tienda, con vencimiento a partir de la vida útil.
          const vida = p.vidaUtilDias;
          await tx.insert(lote).values({
            ubicacionId: t.id,
            skuId: s.id,
            codigoLote: `DEMO-${now.toISOString().slice(0, 10)}`,
            elaboradoEn: new Date(now.getTime() - 1 * DAY),
            venceEn: new Date(now.getTime() + (vida - 1) * DAY),
            cantidadInicial: s.modalidad === 'PACK' ? 100 : 20_000,
            cantidadDisponible: s.modalidad === 'PACK' ? 100 : 20_000,
          });
        }
      }
    }

    const zonaUbic = ubicPorCodigo.get(DEMO_ZONA.ubicacionCodigo)!;
    await tx.insert(zonaReparto).values({
      ubicacionId: zonaUbic.id,
      nombre: DEMO_ZONA.nombre,
      poligono: DEMO_ZONA.poligono,
      tarifaCents: DEMO_ZONA.tarifaCents,
      pedidoMinimoCents: DEMO_ZONA.pedidoMinimoCents,
      envioGratisDesdeCents: DEMO_ZONA.envioGratisDesdeCents,
    });

    for (const u of DEMO_USUARIOS) {
      const ubicacionId = 'ubicacionCodigo' in u ? ubicPorCodigo.get(u.ubicacionCodigo)!.id : null;
      await tx.insert(cliente).values({ nombre: u.nombre, telefono: u.telefono, rol: u.rol, ubicacionId });
    }
  });
}

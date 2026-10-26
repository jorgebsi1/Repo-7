import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { dbOptionsFromEnv, openDb, type Db } from './client';
import { categoria, producto, sku } from './schema';

/** "14.80" → 1480. Sin coma flotante: se parte el texto. */
export function solesToCents(text: string): number {
  const m = /^\s*(\d+)(?:[.,](\d{1,2}))?\s*$/.exec(text);
  if (!m) throw new Error(`Monto inválido: "${text}"`);
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** Parser CSV mínimo (comillas dobles, comas y saltos de línea dentro de comillas). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur);
      cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

export interface ImportSummary {
  categorias: number;
  productos: number;
  skus: number;
  errores: string[];
}

const intOrNull = (v?: string) => (v && v !== '' ? Number.parseInt(v, 10) : null);

/** Carga o actualiza (por código) categorías, productos y SKU. No toca disponibilidad ni lotes. */
export async function importCatalogCsv(db: Db, csvText: string): Promise<ImportSummary> {
  const rows = parseCsv(csvText);
  const summary: ImportSummary = { categorias: 0, productos: 0, skus: 0, errores: [] };
  const cats = new Set<string>();
  const prods = new Set<string>();

  await db.transaction(async (tx) => {
    for (const [i, r] of rows.entries()) {
      const linea = i + 2;
      try {
        const modalidad = r.modalidad;
        if (modalidad !== 'PACK' && modalidad !== 'PESO') throw new Error(`modalidad debe ser PACK o PESO, es "${modalidad}"`);
        if (!r.sku_codigo || !r.producto_codigo || !r.categoria_slug) throw new Error('faltan códigos obligatorios');

        let [cat] = await tx.select().from(categoria).where(eq(categoria.slug, r.categoria_slug!));
        if (!cat) [cat] = await tx.insert(categoria).values({ slug: r.categoria_slug!, nombre: r.categoria_nombre || r.categoria_slug! }).returning();
        cats.add(cat!.id);

        const prodValues = {
          nombre: r.producto_nombre!,
          descripcion: r.descripcion || null,
          categoriaId: cat!.id,
          registroSanitario: r.registro_sanitario || null,
          vidaUtilDias: intOrNull(r.vida_util_dias),
          imagenUrl: r.imagen_url || null,
          esDemo: false,
        };
        let [prod] = await tx.select().from(producto).where(eq(producto.codigo, r.producto_codigo!));
        if (prod) [prod] = await tx.update(producto).set(prodValues).where(eq(producto.id, prod.id)).returning();
        else [prod] = await tx.insert(producto).values({ codigo: r.producto_codigo!, ...prodValues }).returning();
        prods.add(prod!.id);

        const skuValues = {
          productoId: prod!.id,
          presentacion: r.presentacion!,
          modalidad,
          gramos: intOrNull(r.gramos),
          precioCents: modalidad === 'PACK' ? solesToCents(r.precio_soles ?? '') : null,
          precioKgCents: modalidad === 'PESO' ? solesToCents(r.precio_kg_soles ?? '') : null,
          pasoGramos: modalidad === 'PESO' ? (intOrNull(r.paso_gramos) ?? 50) : null,
          minGramos: modalidad === 'PESO' ? (intOrNull(r.min_gramos) ?? 100) : null,
          maxGramos: modalidad === 'PESO' ? intOrNull(r.max_gramos) : null,
        } as const;
        const [existing] = await tx.select().from(sku).where(eq(sku.codigo, r.sku_codigo!));
        if (existing) await tx.update(sku).set(skuValues).where(eq(sku.id, existing.id));
        else await tx.insert(sku).values({ codigo: r.sku_codigo!, ...skuValues });
        summary.skus++;
      } catch (e) {
        summary.errores.push(`Línea ${linea}: ${(e as Error).message}`);
      }
    }
    if (summary.errores.length) throw new Error('rollback');
  }).catch((e: Error) => {
    if (e.message !== 'rollback') throw e;
  });

  summary.categorias = cats.size;
  summary.productos = prods.size;
  if (summary.errores.length) summary.skus = 0;
  return summary;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: pnpm import:catalog <archivo.csv>   (plantilla: apps/api/data/catalogo-plantilla.csv)');
    process.exit(1);
  }
  const h = await openDb(dbOptionsFromEnv());
  try {
    const s = await importCatalogCsv(h.db, readFileSync(file, 'utf8'));
    if (s.errores.length) {
      console.error('No se importó nada. Corrige estos errores:\n' + s.errores.join('\n'));
      process.exit(1);
    }
    console.log(`Importado: ${s.categorias} categorías, ${s.productos} productos, ${s.skus} SKU.`);
  } finally {
    await h.close();
  }
}
if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDb, type DbHandle } from '../src/db/client';
import { importCatalogCsv, parseCsv, solesToCents } from '../src/db/import-catalog';
import { producto, sku } from '../src/db/schema';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('importador de catálogo CSV', () => {
  let h: DbHandle;
  beforeAll(async () => {
    h = await openDb({});
  });
  afterAll(async () => h.close());

  it('convierte soles a céntimos sin coma flotante', () => {
    expect(solesToCents('14.80')).toBe(1480);
    expect(solesToCents('14,8')).toBe(1480);
    expect(solesToCents('7')).toBe(700);
    expect(solesToCents('0.05')).toBe(5);
    expect(() => solesToCents('abc')).toThrow();
    expect(() => solesToCents('1.234')).toThrow();
  });

  it('parsea CSV con comillas y comas internas', () => {
    expect(parseCsv('a,b\n"x, y",2\n')).toEqual([{ a: 'x, y', b: '2' }]);
  });

  it('importa la plantilla y es idempotente al repetirla', async () => {
    const csv = readFileSync(resolve(__dirname, '../data/catalogo-plantilla.csv'), 'utf8');
    const a = await importCatalogCsv(h.db, csv);
    expect(a).toMatchObject({ categorias: 1, productos: 1, skus: 2, errores: [] });
    const b = await importCatalogCsv(h.db, csv);
    expect(b.errores).toEqual([]);
    expect(await h.db.select().from(producto)).toHaveLength(1);
    const skus = await h.db.select().from(sku);
    expect(skus).toHaveLength(2);
    expect(skus.find((s) => s.modalidad === 'PESO')).toMatchObject({ precioKgCents: 3600, pasoGramos: 50, minGramos: 200 });
  });

  it('no importa nada si alguna fila tiene error', async () => {
    const csv = 'categoria_slug,producto_codigo,producto_nombre,sku_codigo,presentacion,modalidad,precio_soles\nx,P1,Uno,S1,1 kg,PACK,10.00\nx,P2,Dos,S2,1 kg,PACK,diez\n';
    const r = await importCatalogCsv(h.db, csv);
    expect(r.errores).toHaveLength(1);
    expect(r.skus).toBe(0);
    expect((await h.db.select().from(sku)).map((s) => s.codigo)).not.toContain('S1');
  });
});

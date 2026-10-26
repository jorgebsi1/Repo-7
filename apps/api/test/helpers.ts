import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { openDb, type DbHandle } from '../src/db/client';
import { seedDemo } from '../src/db/seed';
import type { BusinessConfig, Clock } from '../src/common/tokens';

export interface TestApp {
  app: INestApplication;
  handle: DbHandle;
  clock: Clock & { set(d: Date): void };
  api: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function bootApp(config?: Partial<BusinessConfig>): Promise<TestApp> {
  let current = new Date('2026-03-10T15:00:00Z');
  const clock = { now: () => new Date(current), set: (d: Date) => (current = d) };
  // Con TEST_DATABASE_URL las pruebas corren contra Postgres real (se vacía el esquema antes); si no, PGlite en memoria.
  const url = process.env.TEST_DATABASE_URL;
  if (url) {
    const pool = new Pool({ connectionString: url });
    await pool.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
    await pool.end();
  }
  const handle = await openDb(url ? { databaseUrl: url } : {});
  await seedDemo(handle.db, clock.now());
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.register({ db: handle, clock, config })] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return {
    app,
    handle,
    clock,
    api: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
      await handle.close();
    },
  };
}

export const PHONES = {
  cliente: '+51900000001',
  tienda: '+51900000002',
  repartidor: '+51900000003',
  admin: '+51900000004',
  repartidor2: '+51900000005',
  tienda2: '+51900000006',
  otroCliente: '+51911111111',
} as const;

export async function login(t: TestApp, telefono: string): Promise<string> {
  const r = await t.api().post('/v1/auth/login').send({ telefono, codigo: '123456' }).expect(201);
  return r.body.token as string;
}

export interface Sku {
  id: string;
  codigo: string;
  modalidad: 'PACK' | 'PESO';
  precioCents: number | null;
  precioKgCents: number | null;
  disponible: boolean;
}

export async function loadCatalog(t: TestApp) {
  const ubic = (await t.api().get('/v1/ubicaciones').expect(200)).body as { id: string; codigo: string }[];
  const tienda = ubic.find((u) => u.codigo === 'TRU-CAS')!;
  const cat = (await t.api().get(`/v1/ubicaciones/${tienda.id}/catalogo`).expect(200)).body;
  const skus: Sku[] = cat.categorias.flatMap((c: { productos: { skus: Sku[] }[] }) => c.productos.flatMap((p) => p.skus));
  const bySku = (codigo: string) => {
    const s = skus.find((x) => x.codigo === codigo);
    if (!s) throw new Error(`SKU ${codigo} no está en el catálogo de muestra`);
    return s;
  };
  return { tiendaId: tienda.id, skus, bySku, cat };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let n = 0;
export const idem = () => `test-key-${Date.now()}-${++n}`;

// Tiendas de muestra: Las Casuarinas (-8.1342, -79.0268) y Trujillo 2 (-8.1118, -79.0287); radio de 4 km.
/** Junto a Las Casuarinas (~0,4 km). */
export const DENTRO = { lat: -8.133, lng: -79.03 };
/** Junto a Trujillo 2: ahí atiende Trujillo 2 aunque el cliente tenga elegida otra tienda. */
export const CERCA_T02 = { lat: -8.113, lng: -79.028 };
/** 3,9 km y 4,1 km al este de Las Casuarinas (a esa latitud 1° de longitud ≈ 110,2 km). */
export const A_3_9KM = { lat: -8.1342, lng: -78.9914 };
export const A_4_1KM = { lat: -8.1342, lng: -78.9896 };
/** Chiclayo: sin venta en línea en el piloto. */
export const CHICLAYO = { lat: -6.7714, lng: -79.8409 };

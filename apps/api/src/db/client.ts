import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import { schema } from './schema';

export type Schema = typeof schema;
/** Tipo común a Postgres real (pg) y PGlite: el resto del código no distingue cuál se usa. */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
/** Transacción de Drizzle: misma API de consultas que Db. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface DbHandle {
  db: Db;
  kind: 'postgres' | 'pglite';
  close: () => Promise<void>;
}

const MIGRATIONS_DIR = resolve(__dirname, '../../drizzle');

export interface OpenOptions {
  /** URL de Postgres; si falta se usa PGlite. */
  databaseUrl?: string;
  /** Directorio de PGlite; undefined = en memoria (pruebas). */
  pgliteDir?: string;
}

export async function openDb(opts: OpenOptions = {}): Promise<DbHandle> {
  if (opts.databaseUrl) {
    const pool = new Pool({ connectionString: opts.databaseUrl });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder: MIGRATIONS_DIR });
    return { db: db as unknown as Db, kind: 'postgres', close: () => pool.end() };
  }
  if (opts.pgliteDir) mkdirSync(opts.pgliteDir, { recursive: true });
  const client = new PGlite(opts.pgliteDir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS_DIR });
  return { db: db as unknown as Db, kind: 'pglite', close: () => client.close() };
}

export function dbOptionsFromEnv(): OpenOptions {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) return { databaseUrl };
  return { pgliteDir: process.env.PGLITE_DIR ?? resolve(process.cwd(), '../../.data/pglite') };
}

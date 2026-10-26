import { dbOptionsFromEnv, openDb } from './client';
import { isEmpty, seedDemo } from './seed';

async function main() {
  const h = await openDb(dbOptionsFromEnv());
  try {
    if (!(await isEmpty(h.db))) {
      console.log('La base ya tiene datos; no se vuelve a sembrar.');
      return;
    }
    await seedDemo(h.db);
    console.log(`Datos de muestra (ficticios) cargados en ${h.kind}.`);
  } finally {
    await h.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

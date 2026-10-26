import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule, type AppOptions } from './app.module';
import { dbOptionsFromEnv, openDb } from './db/client';
import { isEmpty, seedDemo } from './db/seed';

export function configureApp(app: INestApplication): void {
  app.enableCors({ origin: true });
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Prolac API').setDescription('Esqueleto de la API (ver docs/14). Datos de muestra ficticios.').setVersion('0.1.0').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, doc);
}

export async function createApp(options: AppOptions): Promise<INestApplication> {
  return NestFactory.create(AppModule.register(options), { logger: ['error', 'warn', 'log'] });
}

async function bootstrap() {
  const handle = await openDb(dbOptionsFromEnv());
  if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO !== 'false' && (await isEmpty(handle.db))) {
    await seedDemo(handle.db);
    console.log('Base vacía: se cargaron datos de muestra (ficticios).');
  }
  const app = await createApp({ db: handle });
  configureApp(app);
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`API Prolac (${handle.kind}) en http://localhost:${port} · documentación en /docs`);
}

if (require.main === module) {
  bootstrap().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

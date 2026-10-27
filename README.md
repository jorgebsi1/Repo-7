# Prolac — venta en línea de lácteos (esqueleto)

Esqueleto de la app de pedidos de **Prolac** (fabricante-minorista de lácteos con tiendas en Trujillo, Chiclayo y Lima).
Es la **estructura del edificio** (reparto por radio de 4 km, cooler y tiempo estimado al cliente; nunca se rechaza una entrega): la lógica, los datos y las pantallas funcionan de punta a punta con **datos de muestra ficticios**; los acabados (catálogo real, fotos, marca, pagos reales) vienen después.

> Contexto, decisiones y análisis (incluida la ingeniería inversa de Uber Eats): ver [`docs/`](docs/00-resumen-ejecutivo.md).
> Qué existe y qué es provisional: [`docs/14-arquitectura-del-esqueleto.md`](docs/14-arquitectura-del-esqueleto.md).

## Arrancar (3 comandos, sin Docker)
Requisitos: Node 22+ y pnpm 10.

```bash
pnpm install
pnpm dev          # API en :4000 y app en :3000 (base PGlite local + datos de muestra)
# abrir http://localhost:3000   ·   documentación de la API: http://localhost:4000/docs
```

Usuarios de prueba (código `123456`, desde la pantalla *Cuenta*): cliente, tienda Las Casuarinas (panel en `/panel`), dos repartidores (vista en `/reparto`) y administrador.
Tarjetas de prueba en el pago: *aprobada* y *rechazada* (no se cobra dinero real).

## Comandos
| Comando | Qué hace |
|---------|----------|
| `pnpm test` | Pruebas del dominio (52) y de la API (42, incluidas e2e) |
| `pnpm typecheck` | Tipos de todo el monorepo |
| `pnpm build` | Compila paquetes, API y app |
| `pnpm --filter @prolac/web e2e` | Recorrido real en Chromium (compra por peso, entrega a domicilio, carga alta y sin repartidores) con capturas en `apps/web/e2e-output/` (requiere `pnpm build` y Playwright) |
| `pnpm seed` | Carga datos de muestra si la base está vacía |
| `pnpm import:catalog <archivo.csv>` | Importa el catálogo real (plantilla: `apps/api/data/catalogo-plantilla.csv`) |

### Postgres real (opcional)
```bash
docker compose up -d
DATABASE_URL=postgres://prolac:prolac@localhost:5432/prolac pnpm dev
TEST_DATABASE_URL=postgres://prolac:prolac@localhost:5432/prolac pnpm --filter @prolac/api test   # vacía el esquema de esa base
```
Sin `DATABASE_URL` la API usa PGlite (Postgres en WASM) en `.data/`.

## Estructura
```
packages/domain     reglas puras: estados del pedido, precios por pack/peso, FEFO, reservas, cobertura por radio, meta de 20 min, tiempo estimado de entrega
packages/ui-tokens  tokens de diseño provisionales (cambiar aquí = cambiar la app)
apps/api            NestJS + Drizzle: catálogo, inventario, carrito, pedidos, pagos (simulados), tienda, entrega
apps/web            Next.js (PWA): app del cliente y panel de tienda en /panel
docs/               dossier de análisis, cuestionario y decisiones
```

## Provisional (no usar en producción)
Login con código fijo · pagos simulados · notificaciones que solo se registran · catálogo, precios, tiendas y coordenadas **ficticios** (marcados `[DEMO]`) · sin mapa ni fotografías · sin facturación electrónica ni Libro de Reclamaciones.

# 14 · Arquitectura del esqueleto (etapa 3)

Qué se construyó, cómo se conecta y qué falta. Las decisiones de fondo vienen de `13-adaptacion-prolac.md`; los datos del negocio, de `12-respuestas-descubrimiento.md`.

## 1. Mapa
```mermaid
flowchart LR
  subgraph WEB[apps/web · Next.js PWA]
    C[Cliente<br/>catálogo · carrito · checkout · seguimiento]
    P[Panel de tienda<br/>/panel]
  end
  subgraph API[apps/api · NestJS]
    CAT[catalog] --- INV[inventory]
    CART[cart] --> CAT
    ORD[orders<br/>única dueña del estado]
    FUL[fulfillment<br/>alistar · pesar · empacar]
    PAY[payments<br/>proveedor simulado]
    DEL[delivery<br/>radio 4 km · tiempo estimado]
    REP[reparto<br/>turnos · meta 20 min]
    NOT[notifications<br/>stub]
    ACC[accounts<br/>login de desarrollo]
  end
  DOM[(packages/domain<br/>reglas puras)]
  DB[(PostgreSQL o PGlite)]
  C & P -->|HTTP + SSE| ORD & CART & CAT & FUL
  ORD --> INV & PAY & NOT & DEL
  REP --> DEL
  ORD & CART & INV & DEL --> DOM
  ORD & INV & CAT --> DB
```

Reglas que el código hace cumplir:
- **Un solo dueño del estado:** solo `OrdersService.transition` cambia el estado; valida con `applyEvent` del dominio (actor, estado, condición) y registra cada cambio en `evento_pedido` (solo se inserta).
- **El cliente no fija precios:** envía ids y cantidades o gramos; el servidor calcula. Los campos extra se rechazan.
- **Cobro por peso:** se autoriza con margen (10 %); al empacar se captura el total real; si el peso real excede lo autorizado se rechaza.
- **Idempotencia:** `POST /v1/pedidos` exige `Idempotency-Key`; repetirla devuelve el mismo pedido.
- **Stock:** reserva con caducidad (10 min) mientras se paga; vida útil mínima restante y vencimiento más próximo primero (FEFO) cuando hay lotes; el consumo real ocurre al empacar.
- **Reembolso automático** tras cancelar o abandonar un pago fallido.
- **Permisos:** 403 si el rol no puede ejecutar el evento; un cliente nunca ve pedidos ajenos (responde "no existe").

## 2. Datos de la tanda 2 reflejados
| Dato | Dónde |
|------|-------|
| Productos por peso y envasados | `sku.modalidad` (`PACK`/`PESO`), `linea_pedido.gramos_*`, `packages/domain/src/pricing.ts` |
| Vida corta, 2–4 °C | `lote.vence_en`, `producto.temp_*`, `domain/shelf-life.ts`, ventana de frío en `entrega.limite_frio_en` |
| Sin códigos de barras | `sku.codigo` interno; `codigo_barras` opcional |
| Stock casi perenne | `disponibilidad_tienda.cantidad` es opcional (nulo = no se controla) |
| Sin combos | no se construyeron |
| Registro sanitario y etiquetado | `producto.registro_sanitario` y `producto.etiquetado`, visibles en la ficha |
| Sin fotos | `ProductImage` muestra un marcador; `producto.imagen_url` queda listo |
| ~200 SKU | importador CSV (`pnpm import:catalog`) |

## 3. Patrones de Uber Eats aplicados (identidad propia)
Cabecera con tienda y conmutador Recojo/Entrega, barra inferior, chips de categoría, carruseles de tarjetas, ficha con selector y botón "Añadir · precio", barra de carrito fija, checkout corto, seguimiento por pasos, "volver a pedir" y panel por columnas de estado. Colores, tipografía del sistema, íconos y textos son provisionales y propios (`packages/ui-tokens`).

## 4. Cambios respecto al plan aprobado
- **Drizzle + PGlite en lugar de Prisma:** Drizzle no descarga motores binarios y PGlite permite arrancar sin instalar nada. Es lo previsto en el plan como mitigación.
- **Panel de tienda** como grupo de rutas `/panel` de la misma app web (no una app aparte).
- **Redis** no se incluyó: el código no lo usa todavía; se retiró de `docker-compose.yml`.
- ~~Zonas de reparto como polígono JSON~~ → reemplazado en la etapa 4A por un **radio por tienda** (ver §7).
- **Cancelación por la tienda** (`cancelar`) se añadió al panel porque la máquina de estados ya la permitía.

## 5. Lo que es provisional
| Pieza | Estado | Se reemplaza por |
|-------|--------|------------------|
| Autenticación | Código fijo `123456` (se bloquea en producción) | Código por SMS/WhatsApp y sesiones reales |
| Pagos | `SimulatedPaymentProvider` | Niubiz / Izipay / Culqi, Yape y Plin, tras cotizar |
| Notificaciones | Solo se registran | Push, WhatsApp, SMS |
| Catálogo, tiendas, zona, precios | Ficticios `[DEMO]` | Datos reales (CSV y panel) |
| Direcciones | Ubicación de prueba, sin mapa | Autocompletado y mapa |
| Facturación | No existe | Comprobantes electrónicos con proveedor autorizado (confirmar con el contador) |
| Libro de Reclamaciones | No existe | Enlace visible y herramienta de Indecopi (verificar reglamento) |
| Reparto | Vista de repartidor y asignación automática entre 2 repartidores (etapa 4A) | Proveedor externo u otros repartidores, si se decide |
| Distancia | Línea recta (haversine) hasta 4 km | Distancia y tiempo reales por calle con un servicio de mapas |
| Inventario | Disponibilidad y lotes propios; cantidad opcional | **POS de mostrador, recepción de camiones y turnos (etapa 4B)**: la app será el sistema de inventario |
| OpenAPI | Solo lista rutas, sin esquemas de cuerpo | Esquemas generados |
| Reservas vencidas | Se ignoran al calcular disponibilidad; `releaseExpired` existe pero nada lo programa | Tarea periódica |
| Pedidos con pago fallido | Quedan abiertos hasta que el cliente cancela | Cancelación automática por tiempo |

## 6. Verificación realizada
- Dominio: 35 pruebas.
- API: 27 pruebas (importador, flujo completo, pesaje, faltantes, idempotencia, pago rechazado, cancelación, permisos, zonas, vida útil, caducidad de reserva y SSE). Los 23 e2e de pedidos también pasan contra **PostgreSQL 17 real** (instancia temporal; no había Docker).
- Cliente y panel: recorrido real en Chromium (390 px y 1024 px) con capturas revisadas. La revisión encontró y corrigió un desborde del conmutador Recojo/Entrega en móvil.
- `pnpm dev` arranca API y web sin Docker con datos de muestra.
- No verificado: la PWA instalada en un teléfono real, pruebas de carga, accesibilidad con lector de pantalla y el comportamiento sin conexión.

## 7. Etapa 4A / 4A.1 · Reparto y frío (tanda 3 y aclaraciones)
**Reglas vigentes** (ver `12` tanda 3 y «Aclaraciones del propietario»):
- **Cobertura por radio:** cada tienda cubre hasta **4 km** en línea recta (`ubicacion.radio_entrega_km`). Entre las tiendas que cubren una dirección se elige **la más cercana** automáticamente (`packages/domain/src/delivery.ts`). **Es la única razón para no repartir**: si ninguna llega, se informa la distancia a la tienda más cercana y el recojo queda como una opción más.
- **Nunca se rechaza una entrega por carga ni por monto.** No hay pedido mínimo: se suma la tarifa de reparto (plana por tienda). No hay `REPARTO_SATURADO`, `SIN_REPARTIDORES` ni `BAJO_PEDIDO_MINIMO`.
- **Tiempo estimado al cliente** (`packages/domain/src/estimate.ts`): `alistado en cola + espera de repartidor + viaje ideal`, mostrado como **rango redondeado de 5 en 5 min** y un nivel de carga (`NORMAL`/`ALTA`). Se guarda lo prometido en `pedido.entrega_estimada_en` para medir *prometido vs. real*. Sin repartidores de turno se estima con un colchón y el pedido igual entra.
- **Meta de 20 minutos (semáforo, no límite):** el reloj arranca cuando el repartidor **sale** (`despachar`); verde dentro de la meta, ámbar **«demorado»** después. **No hay nivel crítico.** Entregar tarde solo se registra (`entrega.demorado` y el evento) y se avisa.
- **Asignación:** al salir, el pedido va al repartidor de turno **con menos pedidos en ruta** (aunque ya lleve varios); si nadie está de turno, **sale sin repartidor asignado** y lo entrega la tienda.
- **Pedidos por mayor / plantas:** fuera del piloto; las plantas existen como ubicaciones pero no aparecen en la app.

**Parámetros del estimado (hipótesis, `BusinessConfig`):** `prepMinutesPerOrder` 8 (supone una sola persona alistando), `courierCycleMinutes` 35, `pedidosPorViaje` 2, `noCourierBufferMinutes` 30, `idealTripMinutes` 20, `etaRoundingMinutes` 5.

**Piezas:** `POST /v1/entrega/resolver`, `GET /v1/reparto/pedidos` y `POST /v1/reparto/turno` (vista del repartidor), `GET /v1/tienda/reparto` (carga, alertas y promesas vencidas), tabla `repartidor_turno`, migraciones `0001`–`0004`, pantalla `/reparto`, `ColdTimer` (verde/ámbar).

**Verificación:** dominio 52 pruebas; API 42 pruebas (los 38 e2e de pedidos también contra PostgreSQL 17 real); recorrido en Chromium con entrega, cobertura, 6 pedidos de entrega en cola y sin repartidores de turno (capturas 10–19).

**Limitaciones:** la distancia en línea recta subestima la de calle; el estimado es un modelo simple con parámetros sin medir (con 7 pedidos en cola y nadie de turno mostró 110–120 min); no hay compensación automática por demora; los repartidores pertenecen a una sola tienda; sin pedido mínimo, un pedido muy chico con la tarifa plana puede tener un costo de reparto desproporcionado: **la tarifa real está por definir**.

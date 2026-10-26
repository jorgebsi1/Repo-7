# 00 · Resumen ejecutivo

> Dossier de ingeniería inversa **de producto, UX, negocio y arquitectura** de Uber Eats, orientado a diseñar una app de venta online de alimentos para **un solo negocio** (no marketplace), *inspirada* en ella y no clonada.

## 1. Qué es Uber Eats, en una frase
Un marketplace de tres lados (comensales, restaurantes, repartidores) cuyo valor real está en **tres sistemas que el usuario no ve**: catálogo/descubrimiento local, predicción de tiempos (preparación, viaje, entrega) y despacho de repartidores. La app de consumidor es la punta visible.

## 2. Hallazgos principales
| # | Hallazgo | Implicación para nuestro negocio |
|---|----------|----------------------------------|
| 1 | El motor de valor es la **predicción de tiempos** (preparación + viaje + entrega), que alimenta el ETA mostrado y el despacho. | Con un solo local, un ETA honesto basado en la **carga actual de cocina** es el equivalente simple y de mayor impacto. |
| 2 | El despacho evolucionó de *greedy* a **matching global**. | Innecesario al inicio (pocos repartidores). Empezar con asignación manual/regla simple. |
| 3 | El seguimiento del pedido es una **barra de pasos + ETA + repartidor + mapa**: reduce la ansiedad y las llamadas a soporte. | Imprescindible en MVP (versión simple: estados + ETA; mapa en V2). |
| 4 | Funciones de comodidad: **pedido programado**, **pedido grupal** (enlace compartido), **recoger en local**, **volver a pedir**, **suscripción**. | Programado y recoger = MVP. Grupal y suscripción = V2/V3. |
| 5 | El lado negocio es un producto en sí: app de pedidos en tablet (aceptar, pausar, retrasar, agotar ítems, modo alta demanda, horarios) + panel de analítica. | El **panel de cocina** es tan crítico como la app del cliente; sin él, la operación falla. |
| 6 | Ingresos: comisión al restaurante, fees al cliente, publicidad, suscripción. | Como negocio único **no pagas comisión de marketplace**: el margen se defiende con canal propio, fidelización y datos. |
| 7 | Arquitectura de Uber: cientos de microservicios (dato de 2016). | **No replicar.** Un monolito modular es la decisión correcta para un negocio único. |

## 3. Qué tomar, qué descartar, qué reinventar
- **Tomar (patrón, no pantallas):** carrito persistente, checkout corto, estados de pedido claros, ETA como rango, reorden en un toque, pedidos programados, panel de cocina con pausa y agotados.
- **Descartar (no aplica a un negocio único):** descubrimiento multi-restaurante, publicidad pagada, matching global de repartidores, onboarding de comercios, efectos de red de tres lados.
- **Reinventar (diferenciación):** relación directa con el cliente (nombre, historial, preferencias), menú con identidad propia, fidelización sin intermediario, transparencia de precios (sin fees opacos), foco en calidad de la comida a la llegada.

## 4. Riesgo sistémico central
Con un solo negocio, el cuello de botella es la **capacidad de cocina**, no el reparto. Prometer ETAs cortos sin modelar la capacidad crea un bucle de refuerzo: más pedidos → cocina saturada → ETA real > ETA prometido → pérdida de confianza. Se mitiga con **franjas con cupo**, modo alta demanda y pausa automática (ver `05-arquitectura-referencia.md`).

## 5. Recomendación
1. Construir un **MVP en 8–10 semanas**: menú → carrito → pago → estados → panel de cocina → notificaciones (ver `10-roadmap-mvp.md`).
2. Stack pragmático: monolito modular + PostgreSQL/PostGIS + app móvil cross-platform + PWA.
3. Validar antes con una **alternativa low-code** si el volumen esperado es bajo (umbral orientativo propio, ~30 pedidos/día; no es un dato de mercado) — ver `05`.
4. Medir desde el día 1: tiempo de preparación real vs prometido, tasa de abandono de carrito, repetición a 30 días.

## 6. Mapa del dossier
`01` metodología y fuentes · `02` funcionalidades · `03` UX · `04` negocio · `05` arquitectura · `06` datos y API · `07` integraciones · `08` seguridad/legal · `09` diferenciación · `10` roadmap · `99` doble verificación.

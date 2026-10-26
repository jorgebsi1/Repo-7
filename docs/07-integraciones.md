# 07 · Integraciones

## 1. Mapa
| Dominio | Qué resuelve | Opciones | Criterio de elección |
|---------|--------------|----------|----------------------|
| Pagos | Cobro con tarjeta/wallet, 3-DS, reembolsos | Stripe, Adyen, MercadoPago, PayU, Redsys… | Cobertura del país, comisión, soporte de autorización/captura separadas |
| Mapas y geocoding | Autocompletar direcciones, distancia, rutas | Google Maps, Mapbox, OSM + Nominatim/OSRM | Calidad de datos local, coste por petición |
| Notificaciones | Estado del pedido, promos | FCM/APNs (push), Twilio/Vonage (SMS), WhatsApp Business API, Email (SES, Postmark) | Canal preferido del público, coste, opt-in |
| Reparto externo (opcional) | Repartidores bajo demanda | Proveedores last-mile locales | Cobertura, SLA, API de cotización y tracking |
| Impresión de comandas | Ticket en cocina | Impresora térmica ESC/POS, impresión desde navegador | Fiabilidad sin internet |
| POS / contabilidad | Ventas, inventario, facturación | POS local, sistema de facturación fiscal del país | Obligación fiscal |
| Analítica | Embudo, retención | Eventos propios + herramienta de producto | Propiedad de los datos |
| Errores/monitoreo | Detectar fallos | Sentry, Grafana/Prometheus | — |

## 2. Pagos (detalle)
- **Tokenización**: el dispositivo envía datos de tarjeta directamente a la pasarela; el backend solo ve tokens (reduce alcance PCI a SAQ-A).
- Flujo: `authorize` al confirmar → `capture` al aceptar la cocina → `void/refund` si se rechaza o cancela.
- **Webhooks** firmados e idempotentes; reconciliación diaria contra el reporte de la pasarela.
- Pedidos con 3-DS: estado `PAGO_PENDIENTE` con expiración (p. ej. 10 min).
- Efectivo / datáfono contra entrega: método explícito, con límite de monto y riesgo de no-show.
- Propina: cobrada con el pedido y liquidada aparte al repartidor.

## 3. Mapas y reparto
- Zonas de reparto como **polígonos** en PostGIS; validar con `ST_Contains`.
- Tarifa por zona (más simple) o por distancia (más justa). Empezar por zona.
- Cacheo de geocodificaciones para controlar coste.
- Índice hexagonal (H3) es opcional: útil si más adelante se agregan demanda/oferta por celdas; innecesario con un local.

## 4. Notificaciones
| Evento | Canal principal | Respaldo |
|--------|-----------------|----------|
| Pedido recibido/aceptado | Push | SMS/WhatsApp |
| Retraso | Push + texto con nuevo ETA | SMS |
| En camino | Push | — |
| Entregado + valorar | Push | Email |
| Marketing | Push / WhatsApp con **opt-in** | Email |
Reglas: plantillas versionadas, límites de frecuencia, horarios de silencio, registro de consentimiento.

## 5. Cocina offline
La tablet debe tolerar caídas de red: cola local de acciones, reintento, y aviso visible de "sin conexión". Respaldo por SMS/llamada de la plataforma si la cocina no confirma.

## 6. Patrón de integración
Adaptadores detrás de interfaces propias (`PaymentProvider`, `MapProvider`, `Notifier`, `CourierProvider`) para cambiar de proveedor sin tocar el dominio. Probar con *sandbox* y simuladores locales.

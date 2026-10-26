# 04 · Modelo de negocio

## 1. Cómo gana dinero Uber Eats (fuentes B/C; cifras no verificadas)
| Línea | Mecánica | Comentario |
|-------|----------|------------|
| Comisión al restaurante | % del pedido; ~15–30 % según plan (algunas fuentes citan hasta 40 %) | Núcleo del ingreso. Planes con más servicios cobran más. |
| Fees al cliente | Entrega (base + distancia), servicio (% del subtotal), pedido pequeño | Estructura variable según ciudad. |
| Publicidad | Restaurantes pagan por visibilidad y promociones | Alto margen; exige gran volumen de oferta. |
| Suscripción | Uber One: envío reducido/gratis + descuentos | Aumenta frecuencia y retención. |

Estructura de tres lados: cada lado necesita masa crítica en los otros dos.

## 2. Qué cambia en un negocio único
| Concepto | Marketplace | Negocio único (nuestro caso) |
|----------|-------------|------------------------------|
| Comisión pagada | 15–30 % | **0 %** al marketplace; sí pagas pasarela de pago (orden de magnitud ~2.5–3.5 % + fijo; **no verificado**, depende de país y proveedor) |
| Adquisición de clientes | La aporta la plataforma | La pagas tú (marketing, SEO local, redes, referidos) |
| Datos del cliente | De la plataforma | **Tuyos** (ventaja estratégica) |
| Logística | Red de repartidores externos | Propios, externos (last-mile) o recoger en local |
| Escala | Efectos de red | Limitada por capacidad de cocina y radio de entrega |

**Tesis:** el canal propio es rentable si la **repetición** compensa el coste de adquisición. La app debe diseñarse para retención, no solo para la primera compra.

## 3. Ingresos propuestos
1. **Margen de producto** (núcleo).
2. **Tarifa de entrega** por zona (cubre al menos el coste marginal del reparto).
3. **Pedido mínimo** por zona para evitar entregas no rentables.
4. **Propinas** (100 % al repartidor).
5. **Club/suscripción** (V3): cuota fija por envío gratis o beneficios.
6. **Ventas cruzadas** en checkout: bebida, postre, extras (sugerencias, no presión).

## 4. Unit economics (plantilla)
Por pedido:
```
Ingreso      = subtotal + tarifa_entrega
Costos var.  = coste_comida + packaging + comisión_pasarela
             + coste_reparto + descuentos + reembolsos
Margen contribución = Ingreso − Costos var.
```
Punto de equilibrio mensual:
```
pedidos_BE = costos_fijos_mensuales / margen_contribución_por_pedido
```
Ejemplo **ilustrativo** (no es un dato de mercado): subtotal 20, entrega 2.5, comida+packaging 7.5, pasarela 0.8, reparto 3.0, descuentos 1.0 → contribución = 22.5 − 12.3 = **10.2** por pedido; con 3 000 de fijos, BE ≈ 295 pedidos/mes.

Variables a vigilar: ticket medio, % de pedidos con entrega, coste real de reparto por pedido, tasa de reembolsos, CAC y recompra a 30/90 días.

## 5. Palancas de crecimiento (sin marketplace)
- **Reorden y recordatorios** (push/WhatsApp) en horas pico personales.
- **Referidos** con recompensa para ambos lados.
- **Programa de puntos** simple (sellos).
- **Pedidos programados y recurrentes** (comida de oficina, lunch semanal).
- **Pedidos de grupo/empresa** (V2).
- **Canal de WhatsApp/Instagram → enlace de pedido directo.**

## 6. Estrategia frente a los marketplaces
Valorar estar **también** en Uber Eats/otros como canal de adquisición, empujando a los clientes al canal propio con incentivos en el empaque (cupón en bolsa). Cuidado con las cláusulas de exclusividad y paridad de precios de los contratos.

## 7. Riesgos de negocio
- Sin demanda propia, la app queda vacía (el marketplace aporta tráfico, tú no).
- Reparto propio infrautilizado → coste fijo alto. Mitigar: franjas, zonas pequeñas, proveedor externo por demanda.
- Dependencia de promociones. Mitigar: medir recompra sin descuento.

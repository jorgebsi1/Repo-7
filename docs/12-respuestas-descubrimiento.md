# 12 · Respuestas del descubrimiento

Registro de las respuestas del propietario al cuestionario (`11-cuestionario-descubrimiento.md`). Se actualiza tanda a tanda. Las respuestas son **declaraciones del usuario**, no datos verificados.

## Tanda 1 · Identidad del negocio (preguntas 1–10)
| # | Pregunta (resumen) | Respuesta |
|---|--------------------|-----------|
| 1 ★ | Nombre y antigüedad / etapa | La app se llamará **Prolac**. El negocio opera con **tiendas físicas desde hace más de 10 años** y quiere dar el siguiente paso hacia las **ventas en línea**. |
| 2 ★ | Tipo de negocio | **Elabora y vende productos lácteos.** |
| 3 ★ | País, ciudad, barrio y otras ciudades | **Perú · Trujillo · Urbanización Las Casuarinas.** Presencia en **3 ciudades: Chiclayo, Trujillo y Lima.** |
| 4 | Locales y plan de expansión | **6 tiendas físicas y 2 plantas de producción.** Espera seguir expandiéndose. |
| 5 | Propiedad y decisor | Negocio **propio**; el usuario está a cargo de las decisiones. |
| 6 | Qué hace especial al negocio | *No aplica por decisión del usuario* ("solo quiero crear una app para mejorar nuestras ventas"). |
| 7 | Historia, misión, valores | *Ninguna por ahora.* |
| 8 | Orgullo y frustraciones | *No aplica.* |
| 9 | Quién es "nosotros" | *No aplica.* |
| 10 | Roles con la app | *Se definirán durante el desarrollo, en conjunto.* |

### Implicaciones inmediatas
1. **No es un restaurante**: se vende producto lácteo propio, envasado y perecedero. El dossier original (pensado para comida preparada) se reencuadra en `13-adaptacion-prolac.md`.
2. **Multi-tienda y multi-ciudad desde el inicio**: stock y precios por ubicación; elegir tienda de recojo/origen.
3. **Objetivo declarado:** mejorar las ventas con un canal en línea (aún sin meta numérica).
4. **Decisor único** y **desarrollo conjunto con Claude**: no hay equipo técnico declarado (se confirmará en el bloque de equipo).

### Pendiente de confirmar (derivado de la tanda 1)
- Nombre legal/RUC y si "Prolac" ya es marca registrada en Indecopi.
- Cuál de las 3 ciudades será el piloto (Trujillo es la hipótesis por ser donde está el usuario).
- Tiendas por ciudad (¿cuántas en Trujillo, Chiclayo y Lima?).

## Tanda 2 · Catálogo y productos (preguntas 11–20)
| # | Pregunta (resumen) | Respuesta |
|---|--------------------|-----------|
| 11 ★ | SKU y agrupación | Aproximadamente **200 SKU**, agrupados en leche, yogurt, quesos, mantequillas, etc. |
| 12 ★ | Más vendidos y de mayor margen | *Pendiente — se analizará después (acabados).* |
| 13 ★ | Presentaciones y precios | Múltiples presentaciones; en lácteos sólidos **200, 250, 400, 500 y 1000 g**, entre otras. *Lista de precios pendiente — se define más adelante.* El propietario prioriza **avanzar con el esqueleto y la estructura** ("construir el edificio") y dejar los acabados para después. **Uber Eats es el modelo a seguir en lo lógico, lo estructural y lo estético** (se aplica como patrones de interacción con identidad propia; ver `14` §3). |
| 14 ★ | Vida útil y temperatura | Vidas **cortas** porque **no usan preservantes**: las más cortas, **7 a 10 días**. Se conservan a **2–4 °C**. |
| 15 | Código de barras, fresco, granel, peso | **Aún sin códigos de barras.** La mayoría de los productos van **envasados al vacío con precio definido**, y **muchos también se venden por peso** (corte en el momento de la compra). |
| 16 | Estacionales o edición limitada | Casi siempre hay **stock perenne**; rara vez no hay stock. |
| 17 | Combos, packs, canastas | **No se manejan por ahora.** |
| 18 ★ | Registro sanitario por producto | **Sí, todos tienen registro sanitario.** Los mostrará más adelante. |
| 19 | Etiquetado | **Sí**, toda la información relevante que exigen las autoridades. |
| 20 | Fotografías | **Aún no hay fotografías.** Pedirá asesoría sobre este punto más adelante (guía de fotografía de producto: pendiente para la fase de acabados). |

### Implicaciones (ya reflejadas en el esqueleto; ver `14` §2)
1. Dos modalidades de venta (`PACK` y `PESO`) con cobro por peso real.
2. Lotes con vencimiento y vida útil mínima al entregar; ventana de frío en entregas.
3. Códigos internos de SKU; el código de barras queda opcional.
4. Stock perenne: la disponibilidad se controla con un indicador por tienda (la cantidad es opcional).
5. Sin combos en el esqueleto.
6. Importador CSV para cargar los ~200 SKU reales cuando estén listos.

### Cambio de ritmo acordado
El cuestionario v2 sigue disponible, pero las preguntas se entregarán **ordenadas por lo que condiciona la estructura** (sistema de inventario/POS, origen de pedidos, ciudad piloto, reparto, zonas, límite de frío), no por número.

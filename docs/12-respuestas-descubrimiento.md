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

## Tanda 3 · Estructura: sistema, abastecimiento, origen, reparto y frío (preguntas 31, 32, 33, 36, 46, 47, 61, 62, 63, 64)
| # | Pregunta (resumen) | Respuesta |
|---|--------------------|-----------|
| 31 ★ | Sistema actual de inventario, caja y facturación | Un sistema **muy incipiente**; por eso quieren **automatizar sus procesos con la app**. |
| 32 ★ | Cómo se actualiza el stock de cada tienda | Hoy es **conteo manual al cierre de cada turno**. El propietario aclaró que **buscan eliminar ese proceso**: la app tendrá una **interfaz tipo POS para el vendedor de tienda** y **refrescará el stock en tiempo real**. |
| 33 ★ | Abastecimiento de tiendas desde plantas | Las plantas están en **Chota y Chiclayo** y despachan en **camiones frigoríficos** hacia **Trujillo y Lima** todos los **miércoles y domingos**. |
| 36 ★ | Origen de cada pedido en línea | **Por menor:** desde la **tienda más cercana**. **Por mayor:** desde la **planta más cercana**. Decisión: el pedido por mayor queda **fuera del piloto**; solo se deja el diseño preparado. |
| 46 ★ | Lista de las 6 tiendas (ciudad, dirección, horarios) | **Pendiente.** El propietario la entregará después. Las tiendas del esqueleto son ficticias. |
| 47 ★ | Ciudad del piloto | **Trujillo.** |
| 61 ★ | Modalidades | **Ambas:** recojo en tienda y entrega a domicilio. |
| 62 ★ | Quién reparte | Inicialmente **2 repartidores propios**; luego se evaluarán otras posibilidades. |
| 63 ★ | Zonas de entrega | La zona depende del **radio máximo**, definido por ahora en **4 km**. |
| 64 ★ | Límite de frío | Todo lácteo se despacha en **cooler**; el tiempo máximo de entrega es de **20 minutos**. Aclarado: se cuentan **desde que el repartidor sale de la tienda**. |

### Implicaciones (reflejadas en la etapa 4A; ver `14` §7)
1. La zona pasa de polígono a **radio por tienda (4 km)**; la tienda que atiende una dirección se elige **sola** (la más cercana dentro de su radio).
2. La meta de viaje pasa de 90 a **20 minutos**, y el reloj arranca en el **despacho**, no al empacar. *(Corregido después: ver «Aclaraciones» abajo; los 20 min son una meta, no un límite.)*
3. Hay **dos repartidores** de turno por tienda. *(Corregido después: la app **no** rechaza ni desvía a recojo por carga; ver «Aclaraciones».)*
4. La semilla ficticia se corrige: **plantas en Chota y Chiclayo**; solo Trujillo vende en línea en el piloto.
5. Inventario operativo y POS de mostrador (etapa 4B): **la app es el sistema de inventario**, no se integra con uno ajeno.

### Supuestos propios a confirmar
- Máximo de **2 pedidos de entrega por repartidor** a la vez.
- Los repartidores quedan asignados a **una tienda** (no se comparten entre tiendas).
- La distancia de 4 km se mide **en línea recta**, no por calle (hasta tener mapas).

### Aclaraciones del propietario (corrigen mi interpretación de la tanda 3)
| Tema | Aclaración |
|------|-----------|
| 20 minutos | Son el **tiempo ideal de reparto** (la meta). **Se pueden extender**, y lo que se hace es **avisar al cliente el tiempo aproximado**. |
| Rechazar repartos | **No está en sus planes rechazar un reparto ni ofrecer recojo en tienda** por falta de capacidad. La entrega siempre se acepta (dentro de la cobertura de 4 km). |
| Límite crítico de frío | **Sin límite crítico por ahora**: solo semáforo (verde hasta 20 min, ámbar «demorado» después). |
| Pedido mínimo | **No hay.** El cliente puede pedir, por ejemplo, 250 g de mantequilla y **se le agrega el costo de reparto**. *«No queremos friccionar: el usuario no tiene la obligación de comprar de más.»* |

**Lo que estaba mal en la etapa 4A (ya corregido en 4A.1):** traté los 20 min como límite duro; rechacé pedidos con `REPARTO_SATURADO`/`SIN_REPARTIDORES` y empujaba al recojo; impedía despachar sin repartidores; y puse un pedido mínimo de S/ 25 (y un envío gratis desde S/ 90) en los datos de muestra que **nadie había pedido**.

**Se mantiene:** radio de **4 km** como cobertura (fuera de él no hay reparto; se informa y el recojo queda como una opción más).

### Supuestos propios a confirmar (actualizado)
Se **retira** el supuesto de «máximo 2 pedidos por repartidor» como tope. Ahora son parámetros del **tiempo estimado** (hipótesis hasta medir): 8 min para alistar un pedido, ciclo de repartidor de 35 min (viaje + vuelta), 2 pedidos por viaje, +30 min si no hay nadie de turno, tarifa plana de S/ 6,00 (muestra) y **sin** envío gratis definido.


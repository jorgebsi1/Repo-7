# 99 · Doble verificación (cierre de etapa)

Etapa cerrada: **Etapa 1 · Ingeniería inversa y dossier de diseño** (sin código de la app).

## 1. Qué hicimos
- Investigación de fuentes públicas sobre Uber Eats: producto, negocio, tiempos/despacho, app de comercios, geoespacial.
- Dossier `docs/00`–`docs/10` con: hallazgos, funcionalidades por actor, UX, modelo de negocio, arquitectura modular y análisis sistémico, datos/estados/API, integraciones, seguridad/legal, diferenciación y roadmap.
- Adaptación a lo que el usuario decidió: **un solo negocio**, **stack agnóstico con recomendación**, **entregable en Markdown**.

## 2. Dónde estamos
Documentación completa para decidir y arrancar. **No hay código ni scaffold** (fuera del alcance acordado). Hay decisiones abiertas que dependen del usuario (`10-roadmap-mvp.md` §5).

## 3. Adónde vamos
1. Responder las decisiones abiertas (país, tipo de negocio, reparto, volumen, low-code vs. a medida, idioma/moneda).
2. Verificar contra fuente original las cifras marcadas "no verificadas" (`01` §6).
3. Etapa 2: scaffold técnico (esquema de BD, API, panel de cocina) según `10` §6.

## 4. Checklist verificado
| Verificación | Resultado |
|--------------|-----------|
| Existen los archivos 00–10 y 99 | ✅ |
| Referencias internas entre documentos apuntan a archivos existentes | ✅ |
| Los 4 diagramas Mermaid (UX, componentes, ER, estados) parsean sin error con `mermaid.parse` | ✅ |
| Cubre los cuatro actores: cliente, cocina, repartidor, admin (`02`) | ✅ |
| Máquina de estados incluye pago fallido, rechazo, cancelación, entrega fallida y reembolso (`06`) | ✅ |
| Descomposición modular, bucles de retroalimentación, efecto de segundo orden y tensión modularidad↔sistema (`05`) | ✅ |
| Cifras no respaldadas están marcadas como "no verificadas" u "orientativas" (`00`, `01`, `04`, `10`) | ✅ (tras corregir `00` y `04` en esta revisión) |
| Se evita copiar marca/UI/textos de Uber Eats (`01` §2, `09`) | ✅ |
| Fuentes citadas con nivel de confianza (`01` §5) | ✅ |

## 5. Huecos y limitaciones conocidas (honestidad)
- **No se leyeron los artículos completos:** el acceso directo a las páginas fuente estuvo bloqueado por la política de red del entorno; se trabajó con resultados de búsqueda y conocimiento general. Es la principal limitación de fiabilidad.
- Datos de arquitectura de Uber son de 2016–2019; la arquitectura actual puede diferir.
- Las partes de **app de repartidor** y de **ranking/descubrimiento** de Uber Eats no se investigaron en profundidad (no son críticas para un negocio único).
- Unit economics y metas de `10` son **ejemplos/plantillas**, no datos reales.
- Marco legal: orientativo; falta validación por país.
- Ninguna parte fue probada con usuarios.

---

# Etapa 2 · Reencuadre a Prolac (lácteos, multi-tienda, Perú)

## 1. Qué hicimos
- Registramos las respuestas de la tanda 1 en `12-respuestas-descubrimiento.md` (preguntas 6–9 marcadas como no aplicables por decisión del usuario).
- Creamos `13-adaptacion-prolac.md`: qué se invalida del dossier original, módulos con inventario por ubicación y capa anticorrupción con el POS/ERP, máquina de estados de retail con frío, análisis sistémico propio, ventajas frente al modelo Uber Eats, lista de cumplimiento en Perú y hipótesis de MVP.
- Reescribimos el cuestionario como **v2 para Prolac** (`11`): 169 preguntas, las 1–10 ya respondidas.
- Añadimos notas de etapa 2 en `00`, `02`–`08` y `10` para que ninguna sección asuma restaurante sin aviso.

## 2. Dónde estamos
Documentación alineada con el negocio real. Siguen sin existir código ni scaffold. Faltan respuestas del cuestionario (tandas 2 a 17) para cerrar las decisiones de `13` §9.

## 3. Adónde vamos
1. Responder el cuestionario v2 por tandas de 10, empezando por catálogo y productos (preguntas 11–20).
2. Con las preguntas ★ respondidas: recomendación entre low-code y desarrollo a medida, alcance del MVP y decisiones abiertas.
3. Verificar con fuente oficial y con asesores (abogado, contador) los temas legales marcados como "sin confirmar".

## 4. Checklist verificado
| Verificación | Resultado |
|--------------|-----------|
| Existen `12` y `13` y las referencias internas entre documentos resuelven | ✅ |
| Los 6 diagramas Mermaid (4 anteriores + 2 nuevos de `13`) pasan `mermaid.parse` | ✅ |
| Numeración del cuestionario v2: 11–169 sin saltos ni duplicados (159 preguntas) | ✅ |
| Conteo de ★ del cuestionario v2: 40 en total (3 de la tanda 1 y 37 de la 11 en adelante). El texto del archivo ya no cita un número fijo | ✅ |
| Las referencias a las preguntas 31–32 en `13` coinciden con las del cuestionario (sistema de inventario y actualización de stock) | ✅ |
| Todas las secciones de `02`–`08` y `10` que asumían restaurante llevan nota de etapa 2 | ✅ |
| Cifras y normas de Perú en `13` §7 llevan estado de verificación; nada se presenta como asesoría legal | ✅ |

## 5. Huecos y limitaciones conocidas
- La investigación sobre Perú salió de resultados de búsqueda y blogs comerciales; los datos legales y de comisiones **no están verificados** con fuente oficial.
- Sin confirmar: requisitos de cadena de frío en venta online, comprobantes electrónicos SUNAT, Ley 29733 de datos personales, cobertura actual de apps de reparto en Trujillo y Chiclayo.
- `02`–`10` conservan su texto original con una nota al inicio; no se reescribieron por completo. Quien lea una sección debe leer también la nota y `13`.
- Las hipótesis de MVP (ciudad piloto, recojo en tienda, captura del pago al empacar) dependen de respuestas aún pendientes.

---

# Etapa 3 · Esqueleto de Prolac ("la estructura del edificio")

## 1. Qué hicimos
- **3A Cimientos:** monorepo pnpm; `packages/domain` (máquina de estados, precios por pack y por peso con margen de autorización, FEFO, reservas con caducidad, zonas de reparto, ventana de frío, efectos de pago); esquema Drizzle con 16 tablas y migración; datos de muestra ficticios; importador de catálogo CSV.
- **3B Estructura:** API NestJS con catálogo, inventario, carrito, pedidos (única dueña del estado), pagos simulados, panel de tienda (alistar, pesar, faltantes, empacar, despachar), entrega, cuentas de desarrollo y notificaciones simuladas.
- **3C Fachada:** app del cliente (PWA) y panel de tienda con los patrones de Uber Eats y identidad propia provisional (`packages/ui-tokens`).
- Cierre: `README.md`, `14-arquitectura-del-esqueleto.md`, respuestas de la tanda 2 en `12`.

## 2. Dónde estamos
Hay un esqueleto que funciona de punta a punta con datos ficticios: un cliente compra queso por peso y leche envasada, la tienda alista, pesa 430 g en lugar de 450 g, empaca y entrega; al cliente se le cobra el total real (S/ 28.48 en vez de S/ 29.20 estimado). No hay catálogo, precios ni fotos reales, ni pagos reales, ni facturación.

## 3. Adónde vamos
1. Responder las preguntas estructurales del cuestionario (31, 32, 33, 36, 46, 47, 61, 62, 63, 64): sistema de inventario/POS, origen de pedidos, ciudad piloto, reparto y frío.
2. Con esas respuestas: integración con el POS/ERP, pasarela de pago y facturación (todas hoy son interfaces o simulaciones).
3. Acabados: catálogo real por CSV, fotografía, marca, textos, mapa, notificaciones reales, Libro de Reclamaciones.

## 4. Checklist verificado
| Verificación | Resultado |
|--------------|-----------|
| Dominio: 35 pruebas en verde; sin imports de frameworks | ✅ |
| API: 27 pruebas en verde con PGlite (importador, flujo, pesaje, faltantes, idempotencia, pago rechazado, cancelación, permisos, zonas, vida útil, caducidad de reserva, SSE) | ✅ |
| Los 23 e2e de pedidos contra **PostgreSQL 17 real** (instancia temporal, sin Docker) | ✅ |
| Ninguna transición fuera de la máquina de estados; el rol sin permiso recibe 403 y el estado incorrecto 409 | ✅ |
| El cliente no puede fijar precios (campos extra → 400; total calculado en servidor) | ✅ |
| Idempotencia: misma clave no duplica pedido ni cobro | ✅ |
| `pnpm typecheck` y `pnpm build` (paquetes, API y Next.js) sin errores | ✅ |
| Recorrido real en Chromium (cliente 390 px + panel 1024 px): compra, pesaje, empaque, entrega y vista final del cliente, sin errores de JavaScript | ✅ |
| Capturas revisadas a ojo: se detectó y corrigió un desborde del conmutador Recojo/Entrega en móvil | ✅ (tras corregir) |
| `pnpm dev` levanta API y web sin Docker con datos de muestra | ✅ |
| Los diagramas Mermaid (incluido el nuevo de `14`) pasan `mermaid.parse` | ✅ |
| Datos ficticios marcados `[DEMO]`; lo provisional documentado en `14` §5 | ✅ |

## 5. Huecos y limitaciones conocidas
- **Estética:** se aplicaron los patrones de interacción de Uber Eats, no su aspecto exacto; los tokens son neutros y provisionales. La identidad final depende de la marca de Prolac (pregunta 101).
- **Docker no estaba disponible** en el entorno: `docker-compose.yml` no se ejecutó (sí se probó contra un Postgres 17 temporal).
- **No verificado:** instalación de la PWA en un teléfono real, rendimiento con muchos pedidos, accesibilidad con lector de pantalla, modo sin conexión, y pruebas con usuarios reales.
- **Inventario:** la integración con el POS/ERP es una interfaz pendiente; sin saber qué sistema usan hay riesgo de doble fuente de verdad (ver `13` §5).
- **Pendientes técnicos conocidos:** nada programa la liberación de reservas vencidas ni la cancelación de pedidos con pago fallido; OpenAPI sin esquemas de cuerpo; login de desarrollo.
- **Legal:** nada nuevo se verificó; siguen vigentes los pendientes de `13` §7 (cadena de frío, SUNAT, Ley 29733, Libro de Reclamaciones).
- Se usó Drizzle y no Prisma (ver `14` §4).

---

# Etapa 4A · Reparto y frío

## 1. Qué hicimos
- Registramos la tanda 3 en `12` y actualizamos `11` y `13` (decisiones cerradas y pendientes).
- **Dominio:** distancia en línea recta, tienda más cercana dentro de 4 km, cotización por tienda, reloj de frío de 20 minutos y estado de la ventana, capacidad de reparto y asignación de repartidor (47 pruebas).
- **Datos:** migraciones `0001` (radio por tienda, elimina `zona_reparto`) y `0002` (`repartidor_turno`); semilla corregida: plantas en Chota y Chiclayo, solo Trujillo vende en línea, 2 repartidores y una tienda de Trujillo con personal propio.
- **API:** la tienda se resuelve por la dirección; capacidad de reparto; el reloj arranca al salir el repartidor; asignación del menos cargado; entrega tardía registrada; vista del repartidor y resumen para el panel (38 pruebas).
- **App:** checkout con tienda automática y mensajes de cobertura, cuenta regresiva para el cliente, la tienda y el repartidor, pantalla `/reparto`.

## 2. Dónde estamos
La entrega a domicilio funciona de punta a punta con reglas reales de Prolac (4 km, cooler, 20 minutos, 2 repartidores). Falta la etapa 4B (POS de mostrador, recepción de camiones, turnos) para que el inventario sea en tiempo real.

## 3. Adónde vamos
1. **Etapa 4B** (con revisión de alcance antes de construir): stock real con movimientos, caja de mostrador, recepción de camiones, apertura y cierre de turno.
2. Datos reales: tiendas (pregunta 46), catálogo y precios por CSV, fotos.
3. Pasarela de pago, facturación electrónica y notificaciones reales.

## 4. Checklist verificado
| Verificación | Resultado |
|--------------|-----------|
| Dominio: 47 pruebas (borde de 3,9 y 4,1 km, dos tiendas, reloj de 20 min justo en el límite, capacidad, desempate) | ✅ |
| API: 38 pruebas con PGlite; los 34 e2e de pedidos también contra **PostgreSQL 17 real** (las migraciones nuevas se aplican en ambos) | ✅ |
| La tienda la decide la dirección aunque el cliente tenga otra elegida; el personal de otra tienda no ve el pedido | ✅ |
| Fuera de 4 km: rechazo con la tienda más cercana y su distancia; Chiclayo sin venta en línea en el piloto | ✅ |
| El reloj de 20 min arranca al salir el repartidor (esperar en tienda no cuenta); entrega tardía se registra | ✅ |
| Capacidad: pedido 5 con 2 repartidores → `REPARTO_SATURADO`; sin repartidores → `SIN_REPARTIDORES` y no se puede despachar; recojo sigue disponible | ✅ |
| Asignación al repartidor menos cargado; el otro repartidor no ve pedidos ajenos | ✅ |
| Plantas y pedidos por mayor no aparecen en la app | ✅ |
| `pnpm typecheck`, `pnpm build` y recorrido Playwright con entrega a domicilio, dirección fuera de cobertura y cuenta regresiva (móvil y tablet) | ✅ |
| Capturas 10–16 revisadas a ojo | ✅ |

## 5. Huecos y limitaciones conocidas
- **Distancia en línea recta**: subestima la de calle; con 20 minutos de límite puede prometer entregas que por calle no se cumplen. Hace falta medir tiempos reales en el piloto y luego usar mapas.
- **Supuestos sin confirmar:** máximo de 2 pedidos por repartidor; repartidores fijos a una tienda; tarifa plana por tienda (6,00 en la muestra).
- **Capacidad sin bloqueo:** dos pedidos simultáneos podrían superar el cupo en uno.
- **Sin compensación automática** por entrega fuera de ventana: solo se registra y se avisa.
- **Pruebas de usuario reales:** ninguna; los tiempos de 20 minutos solo se probaron con un reloj simulado.
- Los datos de tiendas, coordenadas y tarifas siguen siendo **ficticios** hasta que se entregue la pregunta 46.
- La etapa 4B (POS e inventario en tiempo real) **no está construida**: hoy el stock sigue siendo el esqueleto de la etapa 3.

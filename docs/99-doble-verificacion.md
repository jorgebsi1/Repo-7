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

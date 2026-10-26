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

# 10 · Roadmap y MVP

## 1. Supuestos
Un local, radio de entrega acotado, equipo pequeño (2–4 personas de producto/ingeniería/diseño), 8–10 semanas para MVP. Los plazos son estimaciones orientativas.

## 2. Fases
### Fase 0 · Descubrimiento (1–2 semanas)
- Definir posicionamiento (`09`), zona de reparto, política de precios y cancelación.
- Decidir reparto: propio / proveedor externo / solo recoger.
- Elegir país → pasarela, impuestos, facturación.
- Entrevistas con 10–15 clientes potenciales; medir demanda (p. ej. lista de espera o pedidos por WhatsApp).
- **Salida:** documento de alcance MVP + decisión low-code vs. a medida.

### Fase 1 · MVP (6–8 semanas)
| Módulo | Entregable |
|--------|------------|
| Catálogo | Menú con opciones, alérgenos, agotados |
| Carrito y precios | Cálculo servidor, promos básicas, propina |
| Pedidos | Máquina de estados completa con rutas de error |
| Pagos | Autorizar/capturar/reembolsar, webhooks idempotentes |
| Entrega | Zonas con polígono, tarifa, mínimo, recoger |
| Capacidad/ETA | Franjas con cupo + ETA por carga |
| Notificaciones | Push + SMS/WhatsApp de estados |
| Panel de cocina | Aceptar, rechazar, pausar, agotados, retraso, impresión |
| Cuentas | OTP, direcciones, historial, reorden |
| Admin | Menú, zonas, reembolsos, métricas básicas |
| Operación | Monitoreo, backups, alertas, términos y privacidad |

**Criterio de salida:** 20 pedidos reales de punta a punta sin intervención técnica, incluyendo 1 rechazo, 1 cancelación y 1 reembolso.

### Fase 2 · Retención (6–8 semanas)
Seguimiento con mapa, reseñas, puntos/sellos, referidos, pedidos programados recurrentes, pedido grupal, analítica de cocina, campañas segmentadas.

### Fase 3 · Escala (continuo)
Club/suscripción, ML de tiempos con el histórico `prometido vs real`, optimización de rutas/batching si hay varios repartidores, segundo local (activar entidad `Local`), integraciones con POS.

## 3. Métricas
| Categoría | Métrica | Meta orientativa MVP |
|-----------|---------|----------------------|
| Adquisición | Instalaciones / sesiones web, CAC | Medir línea base |
| Conversión | Menú→carrito→pago, abandono por paso | Pago completado > 60 % de los que inician checkout |
| Operación | Prometido vs. real (p80), % pedidos tarde, rechazos | Retraso > 10 min en < 10 % |
| Calidad | Valoración comida / entrega, reembolsos | Reembolsos < 3 % |
| Retención | Recompra 30 y 90 días, uso de "reordenar" | Recompra 30 d > 25 % |
| Economía | Margen de contribución por pedido, % descuentos | Positivo desde el mes 2–3 |
(Metas orientativas: fijarlas con datos reales del negocio.)

## 4. Riesgos y mitigaciones
| Riesgo | Prob. | Impacto | Mitigación |
|--------|-------|---------|------------|
| Poca demanda propia | Alta | Alto | Validar con low-code/WhatsApp; promoción local; referidos |
| Cocina saturada y ETA falso | Media | Alto | Cupos, pausa automática, ETA por carga |
| Reparto caro o inestable | Media | Alto | Zona pequeña, proveedor externo, mínimos |
| Fallos de pago/duplicados | Media | Alto | Idempotencia, reconciliación diaria |
| Sobre-ingeniería | Media | Medio | Monolito modular; extraer solo con evidencia |
| Cumplimiento (alérgenos, fiscal, laboral) | Media | Alto | Revisión legal en Fase 0 |
| Dependencia de un proveedor | Baja | Medio | Adaptadores por interfaz |

## 5. Decisiones abiertas (requieren tu respuesta)
1. País y ciudad de operación (pasarela, impuestos, facturación).
2. Tipo de negocio (restaurante, dark kitchen, panadería, etc.) y tamaño del menú.
3. Reparto: propio, externo o solo recoger.
4. Volumen diario esperado y presupuesto de desarrollo.
5. Low-code para validar o desarrollo a medida directo.
6. Idioma(s) y moneda.

## 6. Primer backlog técnico (si se aprueba)
1. Repositorio, CI (lint, tests, escaneo de secretos), entornos dev/staging/prod.
2. Esquema de BD y migraciones (`06`).
3. Módulo `Pedidos` con tests de la máquina de estados.
4. API de menú y carrito con cálculo servidor.
5. Integración de pagos en sandbox.
6. Panel de cocina (SSE).
7. App cliente: menú → carrito → checkout → seguimiento.

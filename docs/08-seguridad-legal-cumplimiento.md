# 08 · Seguridad, legal y cumplimiento

> Orientación general, **no asesoría legal**. Validar con un abogado y un contador del país de operación.

## 1. Seguridad técnica
| Área | Medidas mínimas |
|------|-----------------|
| Autenticación | OTP por SMS/email, JWT de vida corta + refresh rotatorio, límites de intentos, detección de abuso |
| Autorización | Roles (cliente, cocina, repartidor, admin), comprobación **por objeto** (un cliente solo ve sus pedidos) |
| Datos de pago | Tokenización en pasarela; nunca guardar PAN/CVV (alcance PCI mínimo) |
| Transporte y reposo | TLS 1.2+, cifrado de BD y backups, secretos en gestor (no en el repo) |
| API | Validación de entrada, rate limiting, **idempotencia** en creación de pedidos y pagos, CORS estricto |
| Precios | Cálculo siempre en servidor; el cliente no envía importes |
| Webhooks | Verificar firma, anti-replay |
| Auditoría | Registro inmutable de transiciones y de acciones administrativas |
| Cadena de suministro | Dependencias fijadas, escaneo de vulnerabilidades y secretos en CI |
| Respaldo | Backups automáticos y **restauración probada** |
| Operación | Alertas por pedidos atascados, pagos huérfanos y picos de errores |

### Abusos típicos a prever
Pedidos falsos (bromas), abuso de cupones, reembolsos fraudulentos, *card testing*, cuentas múltiples para referidos, acoso a repartidores. Controles: verificación de teléfono, límites por dispositivo/tarjeta, cupón de un uso, revisión manual de reembolsos atípicos.

## 2. Privacidad
- Normas aplicables según el país del cliente: GDPR (UE), LGPD (Brasil), leyes locales (p. ej. México, Colombia, Chile, España/LOPDGDD), CCPA/CPRA (California).
- Principios: minimización, base legal por finalidad, consentimiento explícito para marketing, derechos de acceso/rectificación/supresión/portabilidad.
- **Política de privacidad y términos** visibles; registro de consentimientos.
- Ubicación del repartidor: solo mientras hay pedido activo.
- Retención definida (pedidos y facturas por plazo fiscal; datos de marketing hasta baja).
- Proveedores (pasarela, mapas, SMS): contrato de tratamiento de datos.

## 3. Alimentos
- **Alérgenos:** declarar los alérgenos obligatorios por ítem (en la UE, 14) en texto, visibles antes de añadir al carrito; aviso de contaminación cruzada.
- Información nutricional y de ingredientes según normativa local.
- Licencia sanitaria del establecimiento y normas de transporte de alimentos (temperatura, empaque).
- Venta de **alcohol y tabaco**: verificación de edad (identificación en la entrega) o no vender.
- Trazabilidad de incidentes (intoxicación, objeto extraño): procedimiento y registro.

## 4. Fiscal y comercial
- Facturación electrónica / comprobante según el país; IVA/impuestos incluidos o desglosados.
- Política de cancelación y reembolso clara y aceptada antes de pagar.
- Cumplimiento de **derecho del consumidor** (muchos países exceptúan comida perecedera del desistimiento; confirmarlo localmente).
- Precios finales mostrados sin cargos ocultos.

## 5. Laboral (reparto)
Riesgo de **reclasificación laboral**: si los repartidores son propios, definir si son empleados o autónomos según la ley local. Seguro de accidentes, equipamiento, jornada y propinas. Con proveedor externo, este riesgo se traslada contractualmente pero no desaparece del todo.

## 6. Propiedad intelectual
- No usar nombre, logo, colores característicos, iconografía, ilustraciones ni textos de Uber Eats.
- Fotos de platos propias o con licencia; tipografías con licencia; revisar licencias de librerías y datos de mapas (atribución de OSM).
- Marca propia: búsqueda de disponibilidad y registro.

## 7. Accesibilidad
Cumplir WCAG 2.1 AA como objetivo. En algunos mercados es exigencia legal para comercio electrónico.

## 8. Plan de incidentes
Responsables, canal de comunicación, plazo legal de notificación de brecha (p. ej. 72 h en GDPR), plantillas de aviso a clientes y rutina de postmortem.

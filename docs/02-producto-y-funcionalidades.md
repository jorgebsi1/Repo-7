# 02 · Producto y funcionalidades

Inventario por actor. Columnas: **Ref. Uber** (qué hace Uber Eats, según fuentes), **Nuestra versión** (adaptación a negocio único) y **Fase** (M = MVP, 2 = V2, 3 = V3, – = descartar).

## 1. Cliente (app móvil + web/PWA)
| Función | Ref. Uber | Nuestra versión | Fase |
|---------|-----------|-----------------|------|
| Registro / login | Email, teléfono, social | Teléfono (OTP) + email; **modo invitado** hasta el pago | M |
| Menú por categorías | Menú por tienda, con fotos | Menú único con fotos, alérgenos, etiquetas (vegano, picante) | M |
| Búsqueda y filtros | Por cocina, cercanía, precio | Búsqueda dentro del menú + filtros dietéticos | M |
| Personalización de ítems | Modificadores / opciones | Grupos de opciones (min/max), extras con precio, notas | M |
| Carrito persistente | Sí | Persistente entre sesiones y dispositivos (si hay sesión) | M |
| Dirección y zona de reparto | Autocompletado + pin | Autocompletado + validación contra **polígono de cobertura** | M |
| Entrega / recoger en local | Ambos | Ambos; recoger con descuento opcional | M |
| Pedido ahora / programado | Hasta 1 semana, mín. 1 h antes (dato antiguo) | Franjas con **cupo de capacidad** | M |
| Checkout y pago | Tarjeta, wallets, efectivo según país | Tarjeta tokenizada + wallet; efectivo configurable | M |
| Propinas | Sí | Propina al repartidor (sugerida, editable) | M |
| Códigos promocionales | Sí | Códigos con reglas (mínimo, vigencia, un uso) | M |
| Seguimiento del pedido | Barra de pasos, ETA, repartidor | Estados + ETA rango + notificaciones; mapa en vivo | M / 2 |
| Historial y **volver a pedir** | Sí | Reorden en un toque, validando disponibilidad actual | M |
| Reseñas | Sí | Valoración post-entrega (comida / entrega por separado) | 2 |
| Pedido grupal | Enlace compartido, límite y fecha tope, paga cada quien | Enlace + carrito compartido; paga el organizador o cada uno | 2 |
| Suscripción | Uber One (envío $0 + descuentos) | "Club" propio: envío gratis o beneficios fijos | 3 |
| Fidelización | Parcial | Puntos / sellos propios, cumpleaños, referidos | 2 |
| Soporte | Chat/ayuda en pedido | Ayuda contextual por pedido + contacto directo (WhatsApp) | M |
| Descubrimiento multi-restaurante, anuncios | Sí | **No aplica** | – |

## 2. Cocina / local (tablet web)
| Función | Ref. Uber (app Orders) | Nuestra versión | Fase |
|---------|------------------------|-----------------|------|
| Recibir y aceptar/rechazar pedidos | Sí | Alerta sonora, aceptar con tiempo de preparación, rechazar con motivo | M |
| Pausar / reanudar pedidos | Sí | Pausa manual + **pausa automática por saturación** | M |
| Retrasar un pedido | Sí | Ajustar tiempo y notificar al cliente | M |
| Modo alta demanda | Sí | Aumenta tiempos base y reduce cupos | M |
| Marcar ítems/modificadores agotados | Sí | Agotado hoy / hasta fecha | M |
| Editar menú, precios, horarios (incl. festivos) | Sí | Sí, con publicación inmediata | M |
| Tablero de pedidos por estado (nuevo → preparando → listo) | Sí | Kanban de cocina + impresión de comanda | M |
| Analítica | Panel "Manager" | Ventas, ticket medio, tiempos reales de preparación, top ítems | 2 |
| Gestión de reseñas / campañas | Sí | Responder reseñas, campañas segmentadas | 3 |

## 3. Repartidor (app o vista móvil)
| Función | Nota | Fase |
|---------|------|------|
| Lista de entregas asignadas, navegación a destino | Si se usan repartidores propios | M (vista simple) |
| Cambios de estado: recogido, llegué, entregado (con foto/PIN opcional) | Alimentan el seguimiento | M |
| Ubicación en vivo | Para mapa de seguimiento | 2 |
| Pago/liquidación | Si hay repartidores propios | 2 |
| Alternativa: **integrar un proveedor externo de last-mile** | Evita construir app de repartidor | M (opción) |

## 4. Administración
Usuarios y roles, zonas y tarifas de entrega, impuestos, promociones, reembolsos, auditoría de pedidos, exportes contables. Fase M (lo básico) / 2 (reportes).

## 5. Reglas de negocio transversales
- Pedido mínimo configurable por zona; tarifa de entrega por distancia o por zona.
- Un pedido **no se confirma** hasta que el pago esté autorizado (o sea contra-entrega explícito).
- Cupos por franja: `capacidad_franja = f(cocineros, tiempo medio de preparación por ítem)`.
- Todo cambio de estado se registra (quién, cuándo, por qué).

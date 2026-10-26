# 01 · Metodología y fuentes

## 1. Alcance de la "ingeniería inversa"
Se analiza **lo que Uber hace público o es observable desde el uso normal del producto**:
- Blog de ingeniería y newsroom de Uber, páginas públicas de comercios, fichas de tiendas de apps.
- Charlas técnicas públicas (QCon NY 2019) y cobertura de prensa técnica (InfoQ, The New Stack).
- Análisis funcional del flujo de uso (qué hace la app, en qué orden, con qué estados).

## 2. Qué NO se hace (límites legales y éticos)
- No se descompila ni se desofusca el binario de la app.
- No se interceptan ni se usan sus APIs privadas ni sus credenciales.
- No se copian marca, logotipos, iconografía, textos, ilustraciones ni la disposición pixel a pixel.
- Se extraen **patrones, ideas y principios** (no protegibles como tal); la implementación y la identidad visual serán propias.

## 3. Nivel de confianza
| Nivel | Significado |
|-------|-------------|
| **A** | Fuente primaria de Uber (blog, newsroom, página de comercios) o charla técnica pública. |
| **B** | Prensa técnica que cita a Uber (InfoQ, The New Stack). |
| **C** | Blogs secundarios / agregadores de "cómo funciona Uber Eats". Cifras tratadas como **no verificadas**. |
| **D** | Inferencia propia razonada. Se marca explícitamente como inferencia. |

## 4. Limitación de esta investigación
Durante la elaboración se pudo **buscar** en la web, pero el acceso directo a las páginas fuente (descarga completa) estuvo bloqueado por la política de red del entorno. Por tanto, los datos se apoyan en **resúmenes de resultados de búsqueda** y no en lectura íntegra de los artículos. Antes de citar cifras en un documento comercial, hay que **verificar contra la fuente original**.

## 5. Fuentes consultadas
| Tema | Fuente | Nivel |
|------|--------|-------|
| Stack de Uber (2016, microservicios, Docker/Mesos, HAProxy/Hyperbahn) | [Uber Engineering · Tech Stack Part One](https://www.uber.com/blog/tech-stack-part-one-foundation/) | A (dato antiguo) |
| Predicción de tiempos, despacho greedy → matching global | [InfoQ · Time Predictions in Uber Eats](https://www.infoq.com/articles/uber-eats-time-predictions) | B |
| Misma charla | [QCon NY 2019 · Time Predictions in Uber Eats](https://archive.qconnewyork.com/node/75368) | A |
| ML para estimar entrega | [The New Stack · How Uber Eats uses ML to estimate delivery times](https://thenewstack.io/how-uber-eats-uses-machine-learning-to-estimate-delivery-times/) | B |
| Tiempo de espera del repartidor | [Uber · delivery person wait time](https://www.uber.com/en-AU/blog/delivery-person-wait-time/) | A |
| Índice geoespacial H3 | [Uber · H3](https://www.uber.com/blog/h3/) | A |
| Pedido grupal | [Uber · business meal group orders](https://www.uber.com/blog/business-meal-group-orders) | A |
| Seguimiento de pedido, programados | [Uber Newsroom · Uber Eats tech update](https://www.uber.com/tw/en/newsroom/ubereats-tech-update-2/) | A (dato antiguo) |
| App de pedidos para restaurantes | [Uber Eats for Merchants · Orders app](https://merchants.ubereats.com/pa/en/resources/learning-center/uber-eats-orders-app/) | A |
| Ficha de la app de consumidor (Uber One, recoger) | [App Store · Uber Eats](https://apps.apple.com/app/id1058959277) | A |
| Modelo de negocio | [FourWeekMBA](https://fourweekmba.com/uber-eats-business-model/), [Think Insights](https://thinkinsights.net/strategy/uber-eats-delivery-engine) | C |

## 6. Datos que conviene verificar antes de usar
- Rango de comisión al restaurante (15–30 % / hasta 40 % según fuentes C).
- Precio de Uber One y condiciones actuales (varían por país y fecha).
- Ingresos por segmento (cifra de ~12.2 B USD en 2023 citada por una fuente C: usar los reportes 10-K de Uber).
- Cualquier detalle de arquitectura posterior a 2019.

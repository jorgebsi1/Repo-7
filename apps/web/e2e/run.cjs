/**
 * Recorrido de punta a punta (Chromium real): el cliente compra por peso y por pack,
 * la tienda alista, pesa, empaca y entrega, y el cliente ve el pedido entregado con el total real.
 *
 * Requisitos: `pnpm build` hecho y Playwright disponible (npm i -g playwright, o instalado en el entorno).
 * Uso:        pnpm --filter @prolac/web e2e
 * Salida:     capturas en e2e-output/ (390 px móvil y 1024 px tablet)
 */
const { spawn } = require('node:child_process');
const { mkdtempSync, mkdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../../..');
const OUT = path.resolve(__dirname, '../e2e-output');
mkdirSync(OUT, { recursive: true });
const API = 'http://localhost:4000';
const WEB = 'http://localhost:3000';

const procs = [];
function start(cmd, args, opts) {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  p.stdout.on('data', () => {});
  p.stderr.on('data', (d) => process.env.E2E_VERBOSE && process.stderr.write(d));
  procs.push(p);
  return p;
}
async function waitFor(url, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`No respondió: ${url}`);
}
function assert(cond, msg) {
  if (!cond) throw new Error(`✘ ${msg}`);
  console.log(`✔ ${msg}`);
}

(async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'prolac-e2e-'));
  start('node', ['dist/main.js'], { cwd: path.join(ROOT, 'apps/api'), env: { ...process.env, PORT: '4000', PGLITE_DIR: dataDir } });
  start(path.join(ROOT, 'apps/web/node_modules/.bin/next'), ['start', '--port', '3000'], { cwd: path.join(ROOT, 'apps/web'), env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  await waitFor(`${API}/health`);
  await waitFor(WEB);

  const browser = await chromium.launch();
  try {
    // ───── Cliente (móvil 390 px) ─────
    const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-PE' });
    const c = await movil.newPage();
    const errores = [];
    c.on('pageerror', (e) => errores.push(e.message));

    await c.goto(WEB);
    await c.getByRole('heading', { name: 'Quesos', exact: true }).waitFor();
    await c.screenshot({ path: `${OUT}/01-inicio.png` });
    assert(true, 'Inicio carga el catálogo con categorías');

    await c.getByRole('link', { name: /Queso fresco/ }).first().click();
    await c.getByRole('heading', { name: 'Queso fresco' }).waitFor();
    await c.getByRole('button', { name: 'Por peso' }).click();
    for (let i = 0; i < 3; i++) await c.getByRole('button', { name: 'Aumentar' }).click(); // 300 g → 450 g
    await c.getByText('450 g').waitFor();
    await c.screenshot({ path: `${OUT}/02-producto-peso.png` });
    await c.getByRole('button', { name: /Añadir · S\/ 16\.20/ }).click();
    assert(true, 'Queso fresco por peso: 450 g = S/ 16.20');

    await c.getByRole('heading', { name: 'Leche', exact: true }).waitFor();
    await c.getByRole('link', { name: /Leche fresca entera/ }).first().click();
    await c.getByRole('button', { name: 'Aumentar' }).click(); // 2 unidades
    await c.getByRole('button', { name: /Añadir · S\/ 13\.00/ }).click();

    await c.getByRole('link', { name: /Ver carrito/ }).click();
    await c.getByText('Total estimado').waitFor();
    await c.getByText('S/ 29.20').first().waitFor();
    await c.screenshot({ path: `${OUT}/03-carrito.png` });
    assert(true, 'Carrito cotizado por el servidor: S/ 29.20');

    await c.getByRole('button', { name: /Ir a pagar/ }).click();
    await c.getByText('Inicia sesión para pagar').waitFor();
    await c.getByRole('link', { name: 'Iniciar sesión' }).click();
    await c.getByRole('button', { name: 'Cliente de prueba' }).click();
    await c.getByRole('heading', { name: 'Finalizar pedido' }).waitFor();
    await c.screenshot({ path: `${OUT}/04-checkout.png` });
    await c.getByRole('button', { name: /Confirmar pedido/ }).click();
    await c.waitForURL(/\/pedido\//);
    await c.getByRole('status').getByText(/Recibimos tu pedido/).waitFor();
    await c.screenshot({ path: `${OUT}/05-pedido-confirmado.png` });
    const pedidoUrl = c.url();
    assert(/\/pedido\/[0-9a-f-]{36}/.test(pedidoUrl), 'Pedido creado y confirmado (pago simulado aprobado)');

    // ───── Tienda (tablet 1024 px) ─────
    const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 }, locale: 'es-PE' });
    const t = await tablet.newPage();
    t.on('pageerror', (e) => errores.push(e.message));
    await t.goto(`${WEB}/cuenta`);
    await t.getByRole('button', { name: /Tienda Las Casuarinas/ }).click();
    await t.getByRole('heading', { name: 'Nuevos' }).waitFor();
    await t.locator('a[href^="/panel/pedido/"]').first().waitFor();
    await t.screenshot({ path: `${OUT}/06-panel-tablero.png` });
    await t.locator('a[href^="/panel/pedido/"]').first().click();
    await t.getByRole('button', { name: 'Iniciar alistado' }).click();
    await t.getByRole('button', { name: /Producto en la bolsa/ }).click();
    const peso = t.getByLabel('Peso real (gramos)');
    await peso.waitFor();
    await peso.fill('430');
    await t.getByRole('button', { name: 'Registrar peso' }).click();
    await t.getByText('Lista · 430 g').waitFor();
    await t.screenshot({ path: `${OUT}/07-panel-pesaje.png` });
    await t.getByRole('button', { name: /Empacar/ }).click();
    await t.getByText('Total cobrado').waitFor();
    await t.getByText('S/ 28.48').first().waitFor();
    assert(true, 'Panel: se pesó 430 g y se cobra el total real S/ 28.48 (en vez de S/ 29.20)');
    await t.getByRole('button', { name: 'Dejar listo para recojo' }).click();
    await t.getByRole('button', { name: 'Marcar entregado' }).click();
    await t.getByText('Entregado').first().waitFor();
    await t.screenshot({ path: `${OUT}/08-panel-entregado.png` });

    // ───── El cliente ve el resultado (SSE o refresco) ─────
    await c.getByText('¡Gracias por tu compra!').waitFor({ timeout: 20000 });
    await c.getByText('S/ 28.48').first().waitFor();
    await c.screenshot({ path: `${OUT}/09-pedido-entregado.png` });
    assert(true, 'El cliente ve “Entregado” y el total real cobrado');

    // ───── Entrega a domicilio: cobertura de 4 km, tienda automática, repartidor y cooler de 20 min ─────
    await c.goto(WEB);
    await c.getByRole('group', { name: 'Modo de entrega' }).getByRole('button', { name: 'Entrega a domicilio' }).click();
    await c.getByRole('link', { name: /Queso mozzarella/ }).first().click();
    await c.getByRole('button', { name: 'Aumentar' }).click(); // 2 unidades de S/ 23.50
    await c.getByRole('button', { name: /Añadir · S\/ 47\.00/ }).click();
    await c.getByRole('link', { name: /Ver carrito/ }).click();
    await c.getByRole('button', { name: /Ir a pagar/ }).click();
    await c.getByRole('heading', { name: 'Finalizar pedido' }).waitFor();

    await c.getByRole('button', { name: 'A 4,1 km (fuera de cobertura)' }).click();
    await c.getByText(/cubrimos hasta 4 km/).waitFor();
    assert(await c.getByRole('button', { name: /Confirmar pedido/ }).isDisabled(), 'A 4,1 km: fuera de cobertura y no se puede confirmar');
    await c.screenshot({ path: `${OUT}/10-checkout-fuera-de-cobertura.png` });

    await c.getByRole('button', { name: 'Las Casuarinas (cerca de la tienda)' }).click();
    await c.getByRole('status').getByText(/Te atiende/).waitFor();
    assert(true, 'Dirección cercana: la app asigna sola la tienda que atiende');
    await c.screenshot({ path: `${OUT}/11-checkout-entrega.png` });
    await c.getByRole('button', { name: /Confirmar pedido/ }).click();
    await c.waitForURL(/\/pedido\//);
    await c.getByRole('status').getByText(/Recibimos tu pedido/).waitFor();

    // La tienda alista y empaca (no despacha: sale el repartidor)
    await t.goto(`${WEB}/panel`);
    await t.getByText(/repartidor\(es\) de turno/).waitFor();
    await t.screenshot({ path: `${OUT}/12-panel-reparto.png` });
    await t.locator('a[href^="/panel/pedido/"]').first().click();
    await t.getByText(/Entrega a domicilio/).waitFor();
    await t.getByRole('button', { name: 'Iniciar alistado' }).click();
    await t.getByRole('button', { name: /Producto en la bolsa/ }).click();
    await t.getByRole('button', { name: /Empacar/ }).click();
    await t.getByText('Total cobrado').waitFor();
    await t.getByText('S/ 53.00').first().waitFor(); // 2 × 23.50 + entrega 6.00

    // El repartidor sale: arranca el reloj de 20 minutos
    const rep = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-PE' });
    const r = await rep.newPage();
    r.on('pageerror', (e) => errores.push(e.message));
    await r.goto(`${WEB}/cuenta`);
    await r.getByRole('button', { name: /Repartidor 1 de prueba/ }).click();
    await r.getByRole('heading', { name: /Listos para salir \(1\)/ }).waitFor();
    await r.screenshot({ path: `${OUT}/13-reparto-por-salir.png` });
    await r.getByRole('button', { name: /Salir con este pedido/ }).click();
    await r.getByRole('heading', { name: /En ruta \(1\)/ }).waitFor();
    const timer = r.getByRole('timer').first();
    await timer.waitFor();
    const txt = await timer.innerText();
    assert(/^(19|20):\d\d$/.test(txt.trim()), `El repartidor ve la cuenta regresiva de frío desde ~20:00 (${txt.trim()})`);
    await r.screenshot({ path: `${OUT}/14-reparto-en-ruta.png` });

    await c.getByRole('timer').first().waitFor({ timeout: 20000 });
    await c.screenshot({ path: `${OUT}/15-pedido-en-camino.png` });
    assert(true, 'El cliente ve “en camino” con la cuenta regresiva de 20 minutos');

    await r.getByRole('button', { name: 'Entregado', exact: true }).click();
    await c.getByText('¡Gracias por tu compra!').waitFor({ timeout: 20000 });
    await c.screenshot({ path: `${OUT}/16-entrega-completada.png` });
    assert(true, 'Entrega a domicilio completada dentro de la ventana de frío');

    // ───── Nunca se rechaza una entrega: con mucha carga o sin repartidores solo sube el tiempo estimado ─────
    const api = async (path, { token, body, method } = {}) => {
      const r = await fetch(`${API}${path}`, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && body.__idem ? { 'Idempotency-Key': body.__idem } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    const login = async (telefono) => (await api('/v1/auth/login', { body: { telefono, codigo: '123456' } })).body.token;
    const tCliente = await login('+51900000001');
    const tTienda = await login('+51900000002');
    const tRep1 = await login('+51900000003');
    const tRep2 = await login('+51900000005');
    const ubic = (await api('/v1/ubicaciones')).body;
    const tiendaId = ubic.find((u) => u.codigo === 'TRU-CAS').id;
    const cat = (await api(`/v1/ubicaciones/${tiendaId}/catalogo`)).body;
    const moz = cat.categorias.flatMap((x) => x.productos).flatMap((p) => p.skus).find((x) => x.codigo === 'QUE-MOZ-500').id;
    const dir = { linea: 'Av. Carga 1', lat: -8.133, lng: -79.03 };
    let aceptados = 0;
    for (let i = 0; i < 6; i++) {
      const r = await api('/v1/pedidos', { token: tCliente, body: { __idem: `e2e-carga-${Date.now()}-${i}`, ubicacionId: tiendaId, modo: 'ENTREGA', lineas: [{ skuId: moz, cantidad: 1 }], direccion: dir, pago: { token: 'tok_ok' } } });
      if (r.status === 201) aceptados++;
    }
    assert(aceptados === 6, 'Con la carga subiendo, los 6 pedidos de entrega fueron aceptados (ninguno rechazado)');

    await c.goto(WEB);
    await c.getByRole('group', { name: 'Modo de entrega' }).getByRole('button', { name: 'Entrega a domicilio' }).click();
    await c.getByRole('link', { name: /Mantequilla sin sal/ }).first().click();
    await c.getByRole('button', { name: /Añadir · S\/ 14\.90/ }).click(); // un pedido chico: 250 g de mantequilla
    await c.getByRole('link', { name: /Ver carrito/ }).click();
    await c.getByRole('button', { name: /Ir a pagar/ }).click();
    await c.getByRole('heading', { name: 'Finalizar pedido' }).waitFor();
    await c.getByRole('button', { name: 'Las Casuarinas (cerca de la tienda)' }).click();
    await c.getByText(/Entrega estimada:/).waitFor();
    await c.getByText(/Hoy hay más pedidos de lo normal/).waitFor();
    assert(!(await c.getByRole('button', { name: /Confirmar pedido/ }).isDisabled()), 'Pedido chico (S/ 14.90) con mucha carga: se puede confirmar, con tiempo estimado mayor y sin pedido mínimo');
    await c.screenshot({ path: `${OUT}/17-checkout-carga-alta.png` });
    assert((await c.getByText(/saturad|solo recojo|no podemos entregar|sin repartidores/i).count()) === 0, 'Ningún mensaje de rechazo ni de "solo recojo"');
    await c.getByRole('button', { name: /Confirmar pedido/ }).click();
    await c.waitForURL(/\/pedido\//);
    await c.getByText(/Llegada aproximada:/).waitFor();
    await c.screenshot({ path: `${OUT}/18-pedido-llegada-aproximada.png` });

    await api('/v1/reparto/turno', { token: tRep1, body: { enTurno: false } });
    await api('/v1/reparto/turno', { token: tRep2, body: { enTurno: false } });
    await t.goto(`${WEB}/panel`);
    await t.getByRole('alert').getByText(/No hay repartidores de turno/).waitFor();
    await t.screenshot({ path: `${OUT}/19-panel-sin-repartidores.png` });
    const sinRep = await api('/v1/pedidos', { token: tCliente, body: { __idem: `e2e-sinrep-${Date.now()}`, ubicacionId: tiendaId, modo: 'ENTREGA', lineas: [{ skuId: moz, cantidad: 1 }], direccion: dir, pago: { token: 'tok_ok' } } });
    assert(sinRep.status === 201, 'Sin repartidores de turno el pedido de entrega igual se acepta (la tienda ve la alerta)');

    // PWA instalable: manifiesto e íconos accesibles
    const m = await (await fetch(`${WEB}/manifest.webmanifest`)).json();
    assert(m.name && m.icons.length >= 2 && m.display === 'standalone', 'Manifiesto PWA válido');
    assert(errores.length === 0, `Sin errores de JavaScript en el navegador${errores.length ? ': ' + errores.join(' | ') : ''}`);
    console.log(`\nCapturas en ${OUT}`);
  } finally {
    await browser.close();
  }
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    for (const p of procs) p.kill('SIGTERM');
    setTimeout(() => process.exit(process.exitCode ?? 0), 500);
  });

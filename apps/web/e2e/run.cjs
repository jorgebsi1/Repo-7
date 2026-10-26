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

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { lote } from '../src/db/schema';
import { DENTRO, FUERA, PHONES, auth, bootApp, idem, loadCatalog, login, type TestApp } from './helpers';

describe('API de pedidos (e2e, PGlite en memoria)', () => {
  let t: TestApp;
  let cat: Awaited<ReturnType<typeof loadCatalog>>;
  let cliente: string, tienda: string, repartidor: string, admin: string, otro: string;

  beforeAll(async () => {
    t = await bootApp();
    cat = await loadCatalog(t);
    [cliente, tienda, repartidor, admin, otro] = await Promise.all([
      login(t, PHONES.cliente),
      login(t, PHONES.tienda),
      login(t, PHONES.repartidor),
      login(t, PHONES.admin),
      login(t, PHONES.otroCliente),
    ]);
  });
  afterAll(async () => t.close());

  const leche = () => cat.bySku('LECHE-ENT-1000');
  const quesoPeso = () => cat.bySku('QUE-FRE-PESO');

  function crearPedido(body: Record<string, unknown>, token = cliente, key = idem()) {
    return t.api().post("/v1/pedidos").set(auth(token)).set("Idempotency-Key", key).send({ ubicacionId: cat.tiendaId, modo: "RECOJO", pago: { token: "tok_ok" }, ...body });
  }
  const accion = (id: string, a: string, token = tienda) => t.api().post(`/v1/tienda/pedidos/${id}/${a}`).set(auth(token));
  const detalle = async (id: string, token = cliente) => (await t.api().get(`/v1/pedidos/${id}`).set(auth(token)).expect(200)).body;

  it('catálogo: la tienda demo expone productos con disponibilidad y vencimiento', () => {
    expect(cat.skus.length).toBeGreaterThanOrEqual(10);
    expect(leche().disponible).toBe(true);
    expect(quesoPeso()).toMatchObject({ modalidad: 'PESO', precioKgCents: 3600 });
  });

  it('flujo completo de recojo con producto envasado y producto por peso', async () => {
    const lineas = [
      { skuId: leche().id, cantidad: 2 },
      { skuId: quesoPeso().id, gramos: 450 },
    ];
    const r = await crearPedido({ lineas }).expect(201);
    const p = r.body.pedido;
    expect(p.estado).toBe('CONFIRMADO');
    // 2 × S/ 6.50 + 450 g × S/ 36.00/kg = 1300 + 1620
    expect(p.totales.totalEstimadoCents).toBe(2920);
    // autorizado: pack exacto + peso con 10 % de margen (1620 → 1782)
    expect(p.totales.totalAutorizadoCents).toBe(1300 + 1782);
    expect(p.pago).toMatchObject({ estado: 'AUTORIZADO', autorizadoCents: 3082 });

    const tablero = (await t.api().get('/v1/tienda/pedidos?estado=CONFIRMADO').set(auth(tienda)).expect(200)).body;
    expect(tablero.map((x: { id: string }) => x.id)).toContain(p.id);

    await accion(p.id, 'iniciar-alistado').expect(201);
    const det = await detalle(p.id, tienda);
    const lPack = det.lineas.find((l: { modalidad: string }) => l.modalidad === 'PACK');
    const lPeso = det.lineas.find((l: { modalidad: string }) => l.modalidad === 'PESO');

    // No se puede empacar con líneas sin resolver
    await accion(p.id, 'empacar').expect(409);

    await t.api().post(`/v1/tienda/pedidos/${p.id}/lineas/${lPack.id}/confirmar`).set(auth(tienda)).expect(201);
    // El corte real salió a 430 g → se cobra menos: 430 × 36 = 1548
    await t.api().post(`/v1/tienda/pedidos/${p.id}/lineas/${lPeso.id}/pesar`).set(auth(tienda)).send({ gramosReales: 430 }).expect(201);

    const emp = (await accion(p.id, 'empacar').expect(201)).body;
    expect(emp.estado).toBe('EMPACADO');
    expect(emp.totales.totalFinalCents).toBe(1300 + 1548);
    expect(emp.pago).toMatchObject({ estado: 'CAPTURADO', capturadoCents: 2848 });
    expect(emp.entrega).toBeNull(); // recojo: sin reparto

    await accion(p.id, 'despachar').expect(409); // es de recojo
    await accion(p.id, 'dejar-listo').expect(201);
    const fin = (await accion(p.id, 'entregar').expect(201)).body;
    expect(fin.estado).toBe('ENTREGADO');

    const vistaCliente = await detalle(p.id);
    expect(vistaCliente.pasoActual).toBe(4);
    expect(vistaCliente.eventos.map((e: { evento: string }) => e.evento)).toEqual(
      expect.arrayContaining(['crear', 'confirmar', 'pago_autorizado', 'iniciar_alistado', 'linea_pesada', 'empacar', 'dejar_listo', 'entregar']),
    );
  });

  it('pesar por encima del margen autorizado es rechazado', async () => {
    const p = (await crearPedido({ lineas: [{ skuId: quesoPeso().id, gramos: 450 }] }).expect(201)).body.pedido;
    await accion(p.id, 'iniciar-alistado').expect(201);
    const linea = (await detalle(p.id, tienda)).lineas[0];
    const r = await t.api().post(`/v1/tienda/pedidos/${p.id}/lineas/${linea.id}/pesar`).set(auth(tienda)).send({ gramosReales: 520 }).expect(409);
    expect(r.body.code).toBe('EXCEDE_AUTORIZACION');
  });

  it('faltante: el pedido se detiene, se resuelve y se cobra solo lo que se entrega', async () => {
    const p = (await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 1 }, { skuId: cat.bySku('YOG-NAT-200').id, cantidad: 2 }] }).expect(201)).body.pedido;
    await accion(p.id, 'iniciar-alistado').expect(201);
    const ls = (await detalle(p.id, tienda)).lineas;
    const yog = ls.find((l: { nombre: string }) => l.nombre.includes('Yogurt'));
    const lec = ls.find((l: { nombre: string }) => l.nombre.includes('Leche'));

    const f = (await t.api().post(`/v1/tienda/pedidos/${p.id}/lineas/${yog.id}/faltante`).set(auth(tienda)).send({ motivo: 'Se acabó' }).expect(201)).body;
    expect(f.estado).toBe('FALTANTE');
    await accion(p.id, 'empacar').expect(409); // detenido hasta resolver
    await accion(p.id, 'resolver-faltante').expect(201);
    await t.api().post(`/v1/tienda/pedidos/${p.id}/lineas/${lec.id}/confirmar`).set(auth(tienda)).expect(201);
    const emp = (await accion(p.id, 'empacar').expect(201)).body;
    expect(emp.totales.totalFinalCents).toBe(650); // solo la leche
    expect(emp.pago.capturadoCents).toBe(650);
  });

  it('todo faltante: se reembolsa y se anula la autorización', async () => {
    const p = (await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 1 }] }).expect(201)).body.pedido;
    await accion(p.id, 'iniciar-alistado').expect(201);
    const l = (await detalle(p.id, tienda)).lineas[0];
    await t.api().post(`/v1/tienda/pedidos/${p.id}/lineas/${l.id}/faltante`).set(auth(tienda)).send({}).expect(201);
    const r = (await accion(p.id, 'reembolsar-por-faltante').expect(201)).body;
    expect(r.estado).toBe('REEMBOLSADO');
    expect(r.pago.estado).toBe('ANULADO');
  });

  it('idempotencia: reenviar la misma clave no duplica el pedido ni el cobro', async () => {
    const key = idem();
    const body = { lineas: [{ skuId: leche().id, cantidad: 1 }] };
    const a = (await crearPedido(body, cliente, key).expect(201)).body;
    const b = (await crearPedido(body, cliente, key).expect(201)).body;
    expect(a.reutilizado).toBe(false);
    expect(b.reutilizado).toBe(true);
    expect(b.pedido.id).toBe(a.pedido.id);
    const mios = (await t.api().get('/v1/pedidos').set(auth(cliente)).expect(200)).body;
    expect(mios.filter((x: { id: string }) => x.id === a.pedido.id)).toHaveLength(1);
  });

  it('exige la cabecera Idempotency-Key', async () => {
    const r = await t.api().post('/v1/pedidos').set(auth(cliente)).send({ ubicacionId: cat.tiendaId, modo: 'RECOJO', lineas: [{ skuId: leche().id, cantidad: 1 }] }).expect(400);
    expect(r.body.code).toBe('IDEMPOTENCY_KEY_REQUERIDA');
  });

  it('pago rechazado: queda en PAGO_FALLIDO y se puede reintentar', async () => {
    const r = (await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 1 }], pago: { token: 'tok_rechazo' } }).expect(201)).body.pedido;
    expect(r.estado).toBe('PAGO_FALLIDO');
    expect(r.pago).toMatchObject({ estado: 'RECHAZADO', motivo: 'TARJETA_RECHAZADA' });
    const ok = (await t.api().post(`/v1/pedidos/${r.id}/reintentar-pago`).set(auth(cliente)).send({ token: 'tok_ok' }).expect(201)).body;
    expect(ok.estado).toBe('CONFIRMADO');
    expect(ok.pago.estado).toBe('AUTORIZADO');
  });

  it('pago fallido abandonado termina reembolsado sin mover dinero', async () => {
    const r = (await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 1 }], pago: {} }).expect(201)).body.pedido;
    expect(r.estado).toBe('PAGO_FALLIDO');
    const c = (await t.api().post(`/v1/pedidos/${r.id}/cancelar`).set(auth(cliente)).expect(201)).body;
    expect(c.estado).toBe('REEMBOLSADO');
  });

  it('el cliente cancela antes de que la tienda empiece y se anula la autorización; después ya no puede', async () => {
    const a = (await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 1 }] }).expect(201)).body.pedido;
    const c = (await t.api().post(`/v1/pedidos/${a.id}/cancelar`).set(auth(cliente)).expect(201)).body;
    expect(c.estado).toBe('REEMBOLSADO');
    expect(c.pago.estado).toBe('ANULADO');

    const b = (await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 1 }] }).expect(201)).body.pedido;
    await accion(b.id, 'iniciar-alistado').expect(201);
    await t.api().post(`/v1/pedidos/${b.id}/cancelar`).set(auth(cliente)).expect(409);
  });

  it('permisos: el cliente no usa el panel, y un cliente no ve pedidos ajenos', async () => {
    const p = (await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 1 }] }).expect(201)).body.pedido;
    await t.api().get('/v1/tienda/pedidos').set(auth(cliente)).expect(403);
    await t.api().get('/v1/pedidos').expect(401);
    await t.api().get(`/v1/pedidos/${p.id}`).set(auth(otro)).expect(404);
    await accion(p.id, 'iniciar-alistado', cliente).expect(403);
    // tienda y admin sí ven el pedido
    await t.api().get(`/v1/tienda/pedidos/${p.id}`).set(auth(tienda)).expect(200);
    await t.api().get(`/v1/tienda/pedidos/${p.id}`).set(auth(admin)).expect(200);
  });

  it('el cliente no puede fijar precios: campos extra se rechazan y el total sale del servidor', async () => {
    await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 1, precioCents: 1 }] }).expect(400);
    const p = (await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 3 }] }).expect(201)).body.pedido;
    expect(p.totales.totalEstimadoCents).toBe(3 * 650);
  });

  it('validación de cantidades y pesos', async () => {
    const a = await crearPedido({ lineas: [{ skuId: quesoPeso().id, gramos: 175 }] }).expect(400);
    expect(a.body.code).toBe('PESO_INVALIDO');
    const b = await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 0 }] }).expect(400);
    expect(b.body.code).toBe('CANTIDAD_INVALIDA');
  });

  it('agotado: la tienda lo marca y ya no se puede pedir; al reactivarlo vuelve', async () => {
    const s = cat.bySku('MAN-SIN-250');
    await t.api().patch(`/v1/tienda/disponibilidad/${s.id}`).set(auth(tienda)).send({ disponible: false }).expect(200);
    const q = (await t.api().post('/v1/carrito/cotizar').send({ ubicacionId: cat.tiendaId, modo: 'RECOJO', lineas: [{ skuId: s.id, cantidad: 1 }] }).expect(201)).body;
    expect(q.puedePedir).toBe(false);
    const r = await crearPedido({ lineas: [{ skuId: s.id, cantidad: 1 }] }).expect(409);
    expect(r.body.code).toBe('PRODUCTO_NO_DISPONIBLE');
    await t.api().patch(`/v1/tienda/disponibilidad/${s.id}`).set(auth(tienda)).send({ disponible: true }).expect(200);
    await crearPedido({ lineas: [{ skuId: s.id, cantidad: 1 }] }).expect(201);
  });

  it('vida útil: un lote que vence antes del mínimo no se vende', async () => {
    const s = cat.bySku('YOG-FRE-250');
    // Vence en 1 día; el mínimo configurado es 2 días restantes al entregar.
    await t.handle.db.update(lote).set({ venceEn: new Date(t.clock.now().getTime() + 86_400_000) }).where(eq(lote.skuId, s.id));
    const r = await crearPedido({ lineas: [{ skuId: s.id, cantidad: 1 }] }).expect(409);
    expect(r.body.code).toBe('PRODUCTO_NO_DISPONIBLE');
  });

  describe('entrega a domicilio', () => {
    it('fuera de zona y por debajo del pedido mínimo se rechaza', async () => {
      const lineas = [{ skuId: cat.bySku('QUE-MOZ-500').id, cantidad: 1 }]; // S/ 23.50
      const fuera = await crearPedido({ modo: 'ENTREGA', lineas, direccion: { linea: 'Lejos 123', ...FUERA } }).expect(409);
      expect(fuera.body.code).toBe('FUERA_DE_ZONA');
      const chico = await crearPedido({ modo: 'ENTREGA', lineas: [{ skuId: leche().id, cantidad: 1 }], direccion: { linea: 'Cerca 1', ...DENTRO } }).expect(409);
      expect(chico.body.code).toBe('BAJO_PEDIDO_MINIMO');
      expect(chico.body.pedidoMinimoCents).toBe(2500);
    });

    it('flujo con cadena de frío: empaca, despacha, el repartidor entrega', async () => {
      const lineas = [{ skuId: cat.bySku('QUE-MOZ-500').id, cantidad: 1 }, { skuId: leche().id, cantidad: 1 }];
      const p = (await crearPedido({ modo: 'ENTREGA', lineas, direccion: { linea: 'Av. Ejemplo 123', referencia: 'Casa blanca', ...DENTRO }, propinaCents: 200 }).expect(201)).body.pedido;
      expect(p.estado).toBe('CONFIRMADO');
      expect(p.totales.tarifaEntregaCents).toBe(600);
      expect(p.totales.totalEstimadoCents).toBe(2350 + 650 + 600 + 200);

      await accion(p.id, 'iniciar-alistado').expect(201);
      for (const l of (await detalle(p.id, tienda)).lineas) {
        await t.api().post(`/v1/tienda/pedidos/${p.id}/lineas/${l.id}/confirmar`).set(auth(tienda)).expect(201);
      }
      const emp = (await accion(p.id, 'empacar').expect(201)).body;
      expect(new Date(emp.entrega.limiteFrioEn).getTime() - t.clock.now().getTime()).toBe(90 * 60_000);

      await accion(p.id, 'dejar-listo').expect(409); // es de entrega
      expect((await accion(p.id, 'despachar').expect(201)).body.estado).toBe('EN_CAMINO');
      expect((await accion(p.id, 'entregar', repartidor).expect(201)).body.estado).toBe('ENTREGADO');
    });

    it('entrega fallida → reembolso del importe capturado', async () => {
      const p = (await crearPedido({ modo: 'ENTREGA', lineas: [{ skuId: cat.bySku('QUE-MOZ-500').id, cantidad: 2 }], direccion: { linea: 'Av. Ejemplo 124', ...DENTRO } }).expect(201)).body.pedido;
      await accion(p.id, 'iniciar-alistado').expect(201);
      const l = (await detalle(p.id, tienda)).lineas[0];
      await t.api().post(`/v1/tienda/pedidos/${p.id}/lineas/${l.id}/confirmar`).set(auth(tienda)).expect(201);
      await accion(p.id, 'empacar').expect(201);
      await accion(p.id, 'despachar', repartidor).expect(201);
      expect((await accion(p.id, 'fallar-entrega', repartidor).expect(201)).body.estado).toBe('FALLIDO_ENTREGA');
      await accion(p.id, 'reembolsar', tienda).expect(403); // el reembolso lo decide el admin
      const r = (await accion(p.id, 'reembolsar', admin).expect(201)).body;
      expect(r.estado).toBe('REEMBOLSADO');
      expect(r.pago).toMatchObject({ estado: 'REEMBOLSADO', reembolsadoCents: 2 * 2350 + 600 });
    });
  });

  it('volver a pedir: reconstruye la cotización de hoy con los mismos productos', async () => {
    const p = (await crearPedido({ lineas: [{ skuId: quesoPeso().id, gramos: 300 }, { skuId: leche().id, cantidad: 2 }] }).expect(201)).body.pedido;
    const q = (await t.api().post(`/v1/pedidos/${p.id}/reordenar`).set(auth(cliente)).expect(201)).body;
    expect(q.lineas).toHaveLength(2);
    expect(q.puedePedir).toBe(true);
    expect(q.totalEstimadoCents).toBe(p.totales.totalEstimadoCents);
  });

  it('carrito guardado por cliente', async () => {
    await t.api().put('/v1/carrito').set(auth(cliente)).send({ ubicacionId: cat.tiendaId, items: [{ skuId: leche().id, cantidad: 4 }] }).expect(200);
    const c = (await t.api().get('/v1/carrito').set(auth(cliente)).expect(200)).body;
    expect(c.items).toEqual([{ skuId: leche().id, cantidad: 4 }]);
  });

  it('healthcheck', async () => {
    await t.api().get('/health').expect(200);
  });
});

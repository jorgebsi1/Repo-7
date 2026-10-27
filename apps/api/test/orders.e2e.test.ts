import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { cliente as clienteTbl, lote, repartidorTurno, ubicacion } from '../src/db/schema';
import { A_3_9KM, A_4_1KM, CERCA_T02, CHICLAYO, DENTRO, PHONES, auth, bootApp, idem, loadCatalog, login, type TestApp } from './helpers';

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

  describe('entrega a domicilio: cobertura de 4 km y tienda más cercana', () => {
    const moz = (n = 2) => [{ skuId: cat.bySku('QUE-MOZ-500').id, cantidad: n }]; // S/ 23.50 c/u

    /** Pone a un repartidor de turno en otra tienda (en la semilla ambos están en Las Casuarinas). */
    const moverRepartidor = async (telefono: string, codigoTienda: string) => {
      const [rep] = await t.handle.db.select().from(clienteTbl).where(eq(clienteTbl.telefono, telefono));
      const [tienda] = await t.handle.db.select().from(ubicacion).where(eq(ubicacion.codigo, codigoTienda));
      await t.handle.db.update(repartidorTurno).set({ ubicacionId: tienda!.id, enTurno: true }).where(eq(repartidorTurno.repartidorId, rep!.id));
    };

    it('la tienda la decide la dirección: la más cercana dentro del radio, aunque el cliente tenga otra elegida', async () => {
      // Sin repartidores en Trujillo 2 no podría atender: se lo asignamos solo durante esta prueba.
      await moverRepartidor(PHONES.repartidor2, 'TRU-02');
      try {
        const cerca = (await crearPedido({ modo: 'ENTREGA', lineas: moz(), direccion: { linea: 'Cerca de Trujillo 2', ...CERCA_T02 } }).expect(201)).body.pedido;
        expect(cerca.tienda.nombre).toContain('Trujillo 2');
        expect(cerca.totales.tarifaEntregaCents).toBe(500); // tarifa de esa tienda
        const otra = (await crearPedido({ modo: 'ENTREGA', lineas: moz(), direccion: { linea: 'Cerca de Casuarinas', ...DENTRO } }).expect(201)).body.pedido;
        expect(otra.tienda.nombre).toContain('Casuarinas');
        // El personal de otra tienda no ve ni opera pedidos ajenos.
        const tienda2 = await login(t, PHONES.tienda2);
        await t.api().get(`/v1/tienda/pedidos/${cerca.id}`).set(auth(tienda)).expect(404);
        await t.api().get(`/v1/tienda/pedidos/${cerca.id}`).set(auth(tienda2)).expect(200);
        // Limpieza: se cancelan para no ocupar capacidad en las pruebas siguientes.
        await t.api().post(`/v1/pedidos/${cerca.id}/cancelar`).set(auth(cliente)).expect(201);
        await t.api().post(`/v1/pedidos/${otra.id}/cancelar`).set(auth(cliente)).expect(201);
      } finally {
        await moverRepartidor(PHONES.repartidor2, 'TRU-CAS');
      }
    });

    it('cotizar: 3,9 km entra y 4,1 km queda fuera de cobertura, con la tienda más cercana y a cuánto está', async () => {
      const body = (p: { lat: number; lng: number }) => ({ ubicacionId: cat.tiendaId, modo: 'ENTREGA', lineas: moz(), direccion: p });
      const dentro = (await t.api().post('/v1/carrito/cotizar').send(body(A_3_9KM)).expect(201)).body;
      expect(dentro.entrega).toMatchObject({ ok: true });
      expect(dentro.distanciaKm).toBeCloseTo(3.9, 1);
      const fuera = (await t.api().post('/v1/carrito/cotizar').send(body(A_4_1KM)).expect(201)).body;
      expect(fuera.entrega).toMatchObject({ ok: false, reason: 'FUERA_DE_COBERTURA' });
      expect(fuera.puedePedir).toBe(false);
      expect(fuera.entrega.masCercana.distanciaKm).toBeGreaterThan(4);
      const r = await crearPedido({ modo: 'ENTREGA', lineas: moz(), direccion: { linea: 'Muy lejos', ...A_4_1KM } }).expect(409);
      expect(r.body.code).toBe('FUERA_DE_COBERTURA');
      // Chiclayo todavía no vende en línea en el piloto
      const chi = await crearPedido({ modo: 'ENTREGA', lineas: moz(), direccion: { linea: 'Chiclayo', ...CHICLAYO } }).expect(409);
      expect(chi.body.code).toBe('FUERA_DE_COBERTURA');
    });

    it('sin pedido mínimo: 250 g de mantequilla con entrega se acepta y se suma el costo de reparto', async () => {
      const mantequilla = [{ skuId: cat.bySku('MAN-SIN-250').id, cantidad: 1 }]; // S/ 14.90
      const q = (await t.api().post('/v1/carrito/cotizar').send({ ubicacionId: cat.tiendaId, modo: 'ENTREGA', lineas: mantequilla, direccion: DENTRO }).expect(201)).body;
      expect(q.puedePedir).toBe(true);
      expect(q.tarifaEntregaCents).toBe(600);
      expect(q.totalEstimadoCents).toBe(1490 + 600);
      const p = (await crearPedido({ modo: 'ENTREGA', lineas: mantequilla, direccion: { linea: 'Cerca 1', ...DENTRO } }).expect(201)).body.pedido;
      expect(p.estado).toBe('CONFIRMADO');
      expect(p.totales).toMatchObject({ subtotalEstimadoCents: 1490, tarifaEntregaCents: 600, totalEstimadoCents: 2090 });
      await t.api().post(`/v1/pedidos/${p.id}/cancelar`).set(auth(cliente)).expect(201);
    });

    it('la cotización de entrega trae el tiempo aproximado (rango) y el pedido guarda lo prometido', async () => {
      const lineas = [{ skuId: cat.bySku('QUE-MOZ-500').id, cantidad: 1 }];
      const q = (await t.api().post('/v1/carrito/cotizar').send({ ubicacionId: cat.tiendaId, modo: 'ENTREGA', lineas, direccion: DENTRO }).expect(201)).body;
      expect(q.entregaEstimada).toMatchObject({ nivelCarga: 'NORMAL', sinRepartidores: false });
      expect(q.entregaEstimada.minMin).toBeGreaterThanOrEqual(20);
      expect(q.entregaEstimada.maxMin).toBeGreaterThan(q.entregaEstimada.minMin);
      const recojo = (await t.api().post('/v1/carrito/cotizar').send({ ubicacionId: cat.tiendaId, modo: 'RECOJO', lineas }).expect(201)).body;
      expect(recojo.entregaEstimada).toBeNull();
      const p = (await crearPedido({ modo: 'ENTREGA', lineas, direccion: { linea: 'Cerca 2', ...DENTRO } }).expect(201)).body.pedido;
      const prometida = new Date(p.entregaEstimadaEn).getTime();
      expect(prometida - t.clock.now().getTime()).toBe(q.entregaEstimada.maxMin * 60_000);
      await t.api().post(`/v1/pedidos/${p.id}/cancelar`).set(auth(cliente)).expect(201);
    });

    it('el resolver público devuelve tienda, distancia y tarifa', async () => {
      const r = (await t.api().post('/v1/entrega/resolver').send({ ...DENTRO, subtotalCents: 5000 }).expect(201)).body;
      expect(r).toMatchObject({ ok: true, tarifaCents: 600 });
      expect(r.distanciaKm).toBeLessThan(1);
    });

    it('pedidos por mayor / plantas: no se ofrecen en el piloto', async () => {
      const ubic = (await t.api().get('/v1/ubicaciones').expect(200)).body as { codigo: string; ciudad: string }[];
      expect(ubic.every((u) => u.ciudad === 'Trujillo')).toBe(true);
      expect(ubic.some((u) => u.codigo.startsWith('PLANTA'))).toBe(false);
    });
  });

  describe('entrega a domicilio: cooler y 20 minutos desde que sale el repartidor', () => {
    const empacarEntrega = async (lineas = [{ skuId: cat.bySku('QUE-MOZ-500').id, cantidad: 2 }]) => {
      const p = (await crearPedido({ modo: 'ENTREGA', lineas, direccion: { linea: 'Av. Ejemplo 123', referencia: 'Casa blanca', ...DENTRO }, propinaCents: 200 }).expect(201)).body.pedido;
      await accion(p.id, 'iniciar-alistado').expect(201);
      for (const l of (await detalle(p.id, tienda)).lineas) {
        await t.api().post(`/v1/tienda/pedidos/${p.id}/lineas/${l.id}/confirmar`).set(auth(tienda)).expect(201);
      }
      return (await accion(p.id, 'empacar').expect(201)).body;
    };
    const minutos = (n: number) => t.clock.set(new Date(t.clock.now().getTime() + n * 60_000));

    it('al empacar el reloj NO corre; arranca cuando sale el repartidor y vence a los 20 min', async () => {
      const emp = await empacarEntrega();
      expect(emp.totales.totalEstimadoCents).toBe(2 * 2350 + 600 + 200);
      expect(emp.entrega.limiteFrioEn).toBeNull();
      minutos(30); // el pedido espera en la tienda: no cuenta como frío

      await accion(emp.id, 'dejar-listo').expect(409); // es de entrega
      const sale = (await accion(emp.id, 'despachar').expect(201)).body;
      expect(sale.estado).toBe('EN_CAMINO');
      expect(sale.entrega.repartidor).toMatch(/Repartidor [12]/);
      expect(new Date(sale.entrega.limiteFrioEn).getTime() - t.clock.now().getTime()).toBe(20 * 60_000);
      expect(sale.entrega.minutosRestantes).toBe(20);

      minutos(12);
      const mid = await detalle(emp.id, tienda);
      expect(mid.entrega).toMatchObject({ minutosRestantes: 8, demorado: false, nivel: 'EN_TIEMPO' });

      const fin = (await accion(emp.id, 'entregar', repartidor).expect(201)).body;
      expect(fin.estado).toBe('ENTREGADO');
      expect(fin.entrega.demorado).toBe(false);
    });

    it('pasados los 20 min no pasa nada grave: se ve ámbar "demorado", se entrega igual y queda registrado', async () => {
      const emp = await empacarEntrega();
      await accion(emp.id, 'despachar').expect(201);
      minutos(25);
      const vivo = await detalle(emp.id, tienda);
      expect(vivo.entrega).toMatchObject({ demorado: true, nivel: 'DEMORADO' });
      expect(vivo.entrega.minutosRestantes).toBeLessThan(0);
      const fin = (await accion(emp.id, 'entregar', repartidor).expect(201)).body;
      expect(fin.estado).toBe('ENTREGADO');
      expect(fin.entrega.demorado).toBe(true);
      const ev = fin.eventos.find((e: { evento: string }) => e.evento === 'entregar');
      expect(ev.detalle.demorado).toBe(true);
    });

    it('el repartidor ve lo que puede recoger y lo que lleva; sale por su cuenta y queda asignado a él', async () => {
      const emp = await empacarEntrega();
      const antes = (await t.api().get('/v1/reparto/pedidos').set(auth(repartidor)).expect(200)).body;
      expect(antes.enTurno).toBe(true);
      expect(antes.porSalir.map((x: { id: string }) => x.id)).toContain(emp.id);

      await accion(emp.id, 'despachar', repartidor).expect(201);
      const ahora = (await t.api().get('/v1/reparto/pedidos').set(auth(repartidor)).expect(200)).body;
      const mio = ahora.enRuta.find((x: { id: string }) => x.id === emp.id);
      expect(mio).toMatchObject({ minutosRestantes: 20, demorado: false });
      expect(mio.resumen.length).toBeGreaterThan(0);
      // el otro repartidor no lo lleva
      const otroRep = await login(t, PHONES.repartidor2);
      const suyo = (await t.api().get('/v1/reparto/pedidos').set(auth(otroRep)).expect(200)).body;
      expect(suyo.enRuta.map((x: { id: string }) => x.id)).not.toContain(emp.id);
      await accion(emp.id, 'entregar', repartidor).expect(201);
    });

    it('la tienda ve repartidores de turno, pedidos en ruta y la cuenta de frío', async () => {
      const emp = await empacarEntrega();
      await accion(emp.id, 'despachar').expect(201);
      const r = (await t.api().get('/v1/tienda/reparto').set(auth(tienda)).expect(200)).body;
      expect(r.repartidores).toHaveLength(2);
      expect(r.metaViajeMin).toBe(20);
      expect(r.sinRepartidores).toBe(false);
      expect(r.enRuta.find((x: { pedidoId: string }) => x.pedidoId === emp.id)).toMatchObject({ minutosRestantes: 20, demorado: false });
      await accion(emp.id, 'entregar', repartidor).expect(201);
    });

    it('el cliente no puede despachar ni entregar; el repartidor no puede operar el alistado', async () => {
      const emp = await empacarEntrega();
      await accion(emp.id, 'despachar', cliente).expect(403);
      // un pedido recién confirmado: el repartidor puede ver el panel pero no iniciar el alistado
      const nuevo = (await crearPedido({ modo: 'ENTREGA', lineas: [{ skuId: cat.bySku('QUE-MOZ-500').id, cantidad: 2 }], direccion: { linea: 'Av. Ejemplo 9', ...DENTRO } }).expect(201)).body.pedido;
      const r = await accion(nuevo.id, 'iniciar-alistado', repartidor).expect(403);
      expect(r.body.code).toBe('ACTOR_NO_AUTORIZADO');
      await t.api().post(`/v1/pedidos/${nuevo.id}/cancelar`).set(auth(cliente)).expect(201);
      await accion(emp.id, 'despachar', repartidor).expect(201);
      await accion(emp.id, 'entregar', repartidor).expect(201);
    });

    it('entrega fallida → reembolso del importe capturado (solo el admin decide)', async () => {
      const emp = await empacarEntrega();
      await accion(emp.id, 'despachar', repartidor).expect(201);
      expect((await accion(emp.id, 'fallar-entrega', repartidor).expect(201)).body.estado).toBe('FALLIDO_ENTREGA');
      await accion(emp.id, 'reembolsar', tienda).expect(403);
      const r = (await accion(emp.id, 'reembolsar', admin).expect(201)).body;
      expect(r.estado).toBe('REEMBOLSADO');
      expect(r.pago).toMatchObject({ estado: 'REEMBOLSADO', reembolsadoCents: 2 * 2350 + 600 + 200 });
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


  it('reserva de stock: apartada mientras se paga, y vuelve a estar disponible al caducar', async () => {
    const s = cat.bySku('MAN-SAL-200');
    await t.handle.db.update(lote).set({ cantidadDisponible: 2 }).where(eq(lote.skuId, s.id));
    // Pago rechazado: el pedido queda sin pagar pero con 2 unidades apartadas (10 min).
    await crearPedido({ lineas: [{ skuId: s.id, cantidad: 2 }], pago: { token: 'tok_rechazo' } }).expect(201);
    const bloqueado = await crearPedido({ lineas: [{ skuId: s.id, cantidad: 1 }] }).expect(409);
    expect(['SIN_STOCK', 'PRODUCTO_NO_DISPONIBLE']).toContain(bloqueado.body.code);
    // Pasan 11 minutos: la reserva caducó y otro cliente puede comprar.
    t.clock.set(new Date(t.clock.now().getTime() + 11 * 60_000));
    await crearPedido({ lineas: [{ skuId: s.id, cantidad: 1 }] }, otro).expect(201);
  });

  it('canal en vivo (SSE): la tienda recibe el cambio de estado sin recargar', async () => {
    const p = (await crearPedido({ lineas: [{ skuId: leche().id, cantidad: 1 }] }).expect(201)).body.pedido;
    await t.app.listen(0);
    const { port } = t.app.getHttpServer().address() as { port: number };
    const recibido = new Promise<string>((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}/v1/tienda/stream?token=${encodeURIComponent(tienda)}`, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          if (chunk.includes('"estado":"ALISTANDO"')) {
            req.destroy();
            resolve(chunk);
          }
        });
      });
      req.on('error', (e) => (e as NodeJS.ErrnoException).code === 'ECONNRESET' ? undefined : reject(e));
      setTimeout(() => reject(new Error('SSE: no llegó el evento')), 8000);
    });
    await new Promise((r) => setTimeout(r, 300)); // da tiempo a abrir el canal
    await accion(p.id, 'iniciar-alistado').expect(201);
    expect(await recibido).toContain(p.id);
  });

  it('healthcheck', async () => {
    await t.api().get('/health').expect(200);
  });
});

describe('carga de reparto: nunca se rechaza una entrega, solo sube el tiempo estimado (base propia)', () => {
  let t: TestApp;
  let cat: Awaited<ReturnType<typeof loadCatalog>>;
  let cliente: string, tienda: string, rep1: string, rep2: string;

  beforeAll(async () => {
    t = await bootApp();
    cat = await loadCatalog(t);
    [cliente, tienda, rep1, rep2] = await Promise.all([login(t, PHONES.cliente), login(t, PHONES.tienda), login(t, PHONES.repartidor), login(t, PHONES.repartidor2)]);
  });
  afterAll(async () => t.close());

  const lineas = () => [{ skuId: cat.bySku('QUE-MOZ-500').id, cantidad: 2 }];
  const cotizar = async () =>
    (await t.api().post('/v1/carrito/cotizar').send({ ubicacionId: cat.tiendaId, modo: 'ENTREGA', lineas: lineas(), direccion: DENTRO }).expect(201)).body;
  const pedirEntrega = () =>
    t.api().post('/v1/pedidos').set(auth(cliente)).set('Idempotency-Key', idem()).send({ ubicacionId: cat.tiendaId, modo: 'ENTREGA', pago: { token: 'tok_ok' }, lineas: lineas(), direccion: { linea: 'Av. Ejemplo 1', ...DENTRO } });
  const turno = (token: string, enTurno: boolean) => t.api().post('/v1/reparto/turno').set(auth(token)).send({ enTurno }).expect(201);
  const alistarYEmpacar = async (id: string) => {
    await t.api().post(`/v1/tienda/pedidos/${id}/iniciar-alistado`).set(auth(tienda)).expect(201);
    for (const l of (await t.api().get(`/v1/tienda/pedidos/${id}`).set(auth(tienda)).expect(200)).body.lineas) {
      await t.api().post(`/v1/tienda/pedidos/${id}/lineas/${l.id}/confirmar`).set(auth(tienda)).expect(201);
    }
    await t.api().post(`/v1/tienda/pedidos/${id}/empacar`).set(auth(tienda)).expect(201);
  };

  it('con 2 repartidores, muchos pedidos de entrega se aceptan todos y el tiempo estimado va subiendo', async () => {
    const primera = await cotizar();
    expect(primera.entregaEstimada.nivelCarga).toBe('NORMAL');
    let ultimo = primera.entregaEstimada.maxMin;
    for (let i = 0; i < 8; i++) {
      await pedirEntrega().expect(201); // nunca 409: ni a los 4, ni a los 8
      ultimo = Math.max(ultimo, (await cotizar()).entregaEstimada.maxMin);
    }
    const q = await cotizar();
    expect(q.puedePedir).toBe(true);
    expect(q.entregaEstimada.nivelCarga).toBe('ALTA');
    expect(q.entregaEstimada.maxMin).toBeGreaterThan(primera.entregaEstimada.maxMin);
    const panel = (await t.api().get('/v1/tienda/reparto').set(auth(tienda)).expect(200)).body;
    expect(panel).toMatchObject({ nivelCarga: 'ALTA', sinRepartidores: false, pedidosPorAlistar: 8 });
    expect(panel.estimadoNuevo.maxMin).toBe(q.entregaEstimada.maxMin);
  });

  it('el recojo sigue siendo una opción más: no se ofrece como reemplazo ni se exige', async () => {
    const q = await cotizar();
    expect(q.puedePedir).toBe(true);
    expect(JSON.stringify(q)).not.toMatch(/SATURADO|SIN_REPARTIDORES|solo recojo/i);
  });

  it('sin repartidores de turno el pedido igual entra, con tiempo estimado mayor y alerta para la tienda', async () => {
    const antes = (await cotizar()).entregaEstimada.maxMin;
    await turno(rep1, false);
    await turno(rep2, false);
    const q = await cotizar();
    expect(q.puedePedir).toBe(true);
    expect(q.entregaEstimada).toMatchObject({ sinRepartidores: true, nivelCarga: 'ALTA' });
    expect(q.entregaEstimada.maxMin).toBeGreaterThanOrEqual(antes);
    const p = (await pedirEntrega().expect(201)).body.pedido;
    expect(p.estado).toBe('CONFIRMADO');
    const panel = (await t.api().get('/v1/tienda/reparto').set(auth(tienda)).expect(200)).body;
    expect(panel).toMatchObject({ sinRepartidores: true });
    expect(panel.repartidores).toHaveLength(0);
  });

  it('despachar sin repartidores de turno funciona: sale sin asignar y lo entrega la tienda', async () => {
    const p = (await pedirEntrega().expect(201)).body.pedido;
    await alistarYEmpacar(p.id);
    const sale = (await t.api().post(`/v1/tienda/pedidos/${p.id}/despachar`).set(auth(tienda)).expect(201)).body;
    expect(sale.estado).toBe('EN_CAMINO');
    expect(sale.entrega.repartidor).toBeNull();
    expect(sale.entrega.minutosRestantes).toBe(20);
    expect((await t.api().post(`/v1/tienda/pedidos/${p.id}/entregar`).set(auth(tienda)).expect(201)).body.estado).toBe('ENTREGADO');
  });

  it('con repartidores muy cargados igual se despacha, al menos cargado, aunque supere lo recomendado', async () => {
    await turno(rep1, true);
    await turno(rep2, true);
    const confirmados = (await t.api().get('/v1/tienda/pedidos?estado=CONFIRMADO').set(auth(tienda)).expect(200)).body.filter((x: { modo: string }) => x.modo === 'ENTREGA');
    expect(confirmados.length).toBeGreaterThanOrEqual(6);
    const asignados: string[] = [];
    for (const p of confirmados.slice(0, 6)) {
      await alistarYEmpacar(p.id);
      const sale = (await t.api().post(`/v1/tienda/pedidos/${p.id}/despachar`).set(auth(tienda)).expect(201)).body;
      asignados.push(sale.entrega.repartidor);
    }
    const porRepartidor = asignados.reduce<Record<string, number>>((a, n) => ({ ...a, [n]: (a[n] ?? 0) + 1 }), {});
    expect(Object.keys(porRepartidor)).toHaveLength(2); // se reparte entre los dos
    expect(Math.max(...Object.values(porRepartidor))).toBe(3); // 6 pedidos: 3 y 3 (más de 2 cada uno, sin bloqueo)
  });

  it('pedidos con promesa vencida aparecen en el panel de la tienda', async () => {
    t.clock.set(new Date(t.clock.now().getTime() + 3 * 60 * 60_000)); // pasan 3 horas
    const panel = (await t.api().get('/v1/tienda/reparto').set(auth(tienda)).expect(200)).body;
    expect(panel.conPromesaVencida.length).toBeGreaterThan(0);
    expect(panel.enRuta.every((r: { demorado: boolean }) => r.demorado)).toBe(true);
  });
});

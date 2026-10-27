/**
 * DATOS DE MUESTRA FICTICIOS.
 * Sirven para ver la app funcionando. NO son el catálogo, los precios ni las tiendas reales de Prolac:
 * el catálogo real (~200 SKU) se carga con `pnpm import:catalog` desde un CSV (ver data/catalogo-plantilla.csv).
 */
interface DemoUbicacion {
  codigo: string;
  nombre: string;
  tipo: 'PLANTA' | 'TIENDA';
  ciudad: string;
  direccion: string;
  lat?: number;
  lng?: number;
  aceptaOnline: boolean;
  /** Reparto (solo tiendas): radio máximo en km y tarifa plana en céntimos (valores de MUESTRA; sin pedido mínimo). */
  radioEntregaKm?: number;
  tarifaEntregaCents?: number;
  envioGratisDesdeCents?: number;
}

/**
 * Plantas reales (Chota y Chiclayo) con direcciones y coordenadas de muestra. Piloto: solo Trujillo vende en línea.
 * Las tiendas y sus coordenadas son FICTICIAS hasta que el propietario entregue ciudades, direcciones y horarios.
 */
export const DEMO_UBICACIONES: DemoUbicacion[] = [
  { codigo: 'PLANTA-CHOTA', nombre: '[DEMO] Planta Chota', tipo: 'PLANTA', ciudad: 'Chota', direccion: 'Dirección por definir', lat: -6.5586, lng: -78.6486, aceptaOnline: false },
  { codigo: 'PLANTA-CHICLAYO', nombre: '[DEMO] Planta Chiclayo', tipo: 'PLANTA', ciudad: 'Chiclayo', direccion: 'Dirección por definir', lat: -6.7714, lng: -79.8409, aceptaOnline: false },
  { codigo: 'TRU-CAS', nombre: '[DEMO] Prolac Las Casuarinas', tipo: 'TIENDA', ciudad: 'Trujillo', direccion: 'Urb. Las Casuarinas, Trujillo', lat: -8.1342, lng: -79.0268, aceptaOnline: true, radioEntregaKm: 4, tarifaEntregaCents: 600 },
  { codigo: 'TRU-02', nombre: '[DEMO] Prolac Trujillo 2', tipo: 'TIENDA', ciudad: 'Trujillo', direccion: 'Dirección por definir', lat: -8.1118, lng: -79.0287, aceptaOnline: true, radioEntregaKm: 4, tarifaEntregaCents: 500 },
  { codigo: 'CHI-01', nombre: '[DEMO] Prolac Chiclayo 1', tipo: 'TIENDA', ciudad: 'Chiclayo', direccion: 'Dirección por definir', lat: -6.7714, lng: -79.8409, aceptaOnline: false },
  { codigo: 'CHI-02', nombre: '[DEMO] Prolac Chiclayo 2', tipo: 'TIENDA', ciudad: 'Chiclayo', direccion: 'Dirección por definir', lat: -6.7766, lng: -79.8447, aceptaOnline: false },
  { codigo: 'LIM-01', nombre: '[DEMO] Prolac Lima 1', tipo: 'TIENDA', ciudad: 'Lima', direccion: 'Dirección por definir', lat: -12.0464, lng: -77.0428, aceptaOnline: false },
  { codigo: 'LIM-02', nombre: '[DEMO] Prolac Lima 2', tipo: 'TIENDA', ciudad: 'Lima', direccion: 'Dirección por definir', lat: -12.0897, lng: -77.0279, aceptaOnline: false },
];

export const DEMO_CATEGORIAS = [
  { slug: 'leche', nombre: 'Leche', orden: 1 },
  { slug: 'yogurt', nombre: 'Yogurt', orden: 2 },
  { slug: 'quesos', nombre: 'Quesos', orden: 3 },
  { slug: 'mantequillas', nombre: 'Mantequillas', orden: 4 },
  { slug: 'postres', nombre: 'Postres', orden: 5 },
] as const;

interface DemoSku {
  codigo: string;
  presentacion: string;
  modalidad: 'PACK' | 'PESO';
  gramos?: number;
  precioCents?: number;
  precioKgCents?: number;
  pasoGramos?: number;
  minGramos?: number;
  maxGramos?: number;
}
interface DemoProducto {
  codigo: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  vidaUtilDias: number;
  skus: DemoSku[];
}

export const DEMO_PRODUCTOS: DemoProducto[] = [
  {
    codigo: 'LECHE-ENT', nombre: '[DEMO] Leche fresca entera', categoria: 'leche', descripcion: 'Leche fresca pasteurizada, sin conservantes.', vidaUtilDias: 7,
    skus: [
      { codigo: 'LECHE-ENT-1000', presentacion: '1 L', modalidad: 'PACK', gramos: 1000, precioCents: 650 },
      { codigo: 'LECHE-ENT-500', presentacion: '500 mL', modalidad: 'PACK', gramos: 500, precioCents: 380 },
    ],
  },
  {
    codigo: 'YOG-NAT', nombre: '[DEMO] Yogurt natural', categoria: 'yogurt', descripcion: 'Yogurt natural sin azúcar añadida.', vidaUtilDias: 14,
    skus: [
      { codigo: 'YOG-NAT-200', presentacion: '200 g', modalidad: 'PACK', gramos: 200, precioCents: 350 },
      { codigo: 'YOG-NAT-1000', presentacion: '1 kg', modalidad: 'PACK', gramos: 1000, precioCents: 1250 },
    ],
  },
  {
    codigo: 'YOG-FRE', nombre: '[DEMO] Yogurt de fresa', categoria: 'yogurt', descripcion: 'Yogurt con trozos de fruta.', vidaUtilDias: 14,
    skus: [{ codigo: 'YOG-FRE-250', presentacion: '250 g', modalidad: 'PACK', gramos: 250, precioCents: 420 }],
  },
  {
    codigo: 'QUE-FRE', nombre: '[DEMO] Queso fresco', categoria: 'quesos', descripcion: 'Queso fresco de leche entera. Se corta al momento.', vidaUtilDias: 10,
    skus: [
      { codigo: 'QUE-FRE-VAC-400', presentacion: 'Envasado al vacío 400 g', modalidad: 'PACK', gramos: 400, precioCents: 1480 },
      { codigo: 'QUE-FRE-PESO', presentacion: 'Por peso', modalidad: 'PESO', precioKgCents: 3600, pasoGramos: 50, minGramos: 200, maxGramos: 3000 },
    ],
  },
  {
    codigo: 'QUE-AND', nombre: '[DEMO] Queso andino', categoria: 'quesos', descripcion: 'Queso semicurado. Se corta al momento.', vidaUtilDias: 21,
    skus: [
      { codigo: 'QUE-AND-250', presentacion: 'Envasado al vacío 250 g', modalidad: 'PACK', gramos: 250, precioCents: 1250 },
      { codigo: 'QUE-AND-PESO', presentacion: 'Por peso', modalidad: 'PESO', precioKgCents: 4800, pasoGramos: 50, minGramos: 200, maxGramos: 2000 },
    ],
  },
  {
    codigo: 'QUE-MOZ', nombre: '[DEMO] Queso mozzarella', categoria: 'quesos', descripcion: 'Mozzarella para pizzas y gratinados.', vidaUtilDias: 30,
    skus: [
      { codigo: 'QUE-MOZ-500', presentacion: 'Envasado al vacío 500 g', modalidad: 'PACK', gramos: 500, precioCents: 2350 },
      { codigo: 'QUE-MOZ-PESO', presentacion: 'Por peso', modalidad: 'PESO', precioKgCents: 4400, pasoGramos: 100, minGramos: 200, maxGramos: 3000 },
    ],
  },
  {
    codigo: 'MAN-SAL', nombre: '[DEMO] Mantequilla con sal', categoria: 'mantequillas', descripcion: 'Mantequilla de crema de leche.', vidaUtilDias: 45,
    skus: [
      { codigo: 'MAN-SAL-200', presentacion: '200 g', modalidad: 'PACK', gramos: 200, precioCents: 1190 },
      { codigo: 'MAN-SAL-500', presentacion: '500 g', modalidad: 'PACK', gramos: 500, precioCents: 2690 },
    ],
  },
  {
    codigo: 'MAN-SIN', nombre: '[DEMO] Mantequilla sin sal', categoria: 'mantequillas', descripcion: 'Ideal para repostería.', vidaUtilDias: 45,
    skus: [{ codigo: 'MAN-SIN-250', presentacion: '250 g', modalidad: 'PACK', gramos: 250, precioCents: 1490 }],
  },
  {
    codigo: 'POS-MAN', nombre: '[DEMO] Manjar blanco', categoria: 'postres', descripcion: 'Dulce de leche tradicional.', vidaUtilDias: 30,
    skus: [
      { codigo: 'POS-MAN-250', presentacion: '250 g', modalidad: 'PACK', gramos: 250, precioCents: 890 },
      { codigo: 'POS-MAN-1000', presentacion: '1 kg', modalidad: 'PACK', gramos: 1000, precioCents: 2950 },
    ],
  },
];

/** Personal de desarrollo. Teléfonos ficticios; el login de desarrollo usa DEV_LOGIN_CODE. */
export const DEMO_USUARIOS = [
  { nombre: '[DEMO] Cliente', telefono: '+51900000001', rol: 'cliente' },
  { nombre: '[DEMO] Tienda Las Casuarinas', telefono: '+51900000002', rol: 'tienda', ubicacionCodigo: 'TRU-CAS' },
  { nombre: '[DEMO] Repartidor 1', telefono: '+51900000003', rol: 'repartidor', ubicacionCodigo: 'TRU-CAS' },
  { nombre: '[DEMO] Admin', telefono: '+51900000004', rol: 'admin' },
  { nombre: '[DEMO] Repartidor 2', telefono: '+51900000005', rol: 'repartidor', ubicacionCodigo: 'TRU-CAS' },
  { nombre: '[DEMO] Tienda Trujillo 2', telefono: '+51900000006', rol: 'tienda', ubicacionCodigo: 'TRU-02' },
] as const;

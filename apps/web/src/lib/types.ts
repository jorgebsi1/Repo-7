/** Tipos de las respuestas de la API (a mano en el esqueleto; se pueden generar desde OpenAPI más adelante). */
export type Modalidad = 'PACK' | 'PESO';
export type Modo = 'RECOJO' | 'ENTREGA';
export type Rol = 'cliente' | 'tienda' | 'repartidor' | 'admin';

export interface Tienda {
  id: string;
  codigo: string;
  nombre: string;
  ciudad: string;
  direccion: string;
  esDemo: boolean;
}

export interface SkuDto {
  id: string;
  codigo: string;
  presentacion: string;
  modalidad: Modalidad;
  gramos: number | null;
  precioCents: number | null;
  precioKgCents: number | null;
  pasoGramos: number | null;
  minGramos: number | null;
  maxGramos: number | null;
  disponible: boolean | null;
  venceEn: string | null;
}

export interface ProductoDto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  imagenUrl: string | null;
  registroSanitario: string | null;
  etiquetado: Record<string, unknown> | null;
  vidaUtilDias: number | null;
  conservacion?: { minC: number | null; maxC: number | null };
  skus: SkuDto[];
}

export interface CatalogoDto {
  tienda: { id: string; nombre: string; ciudad: string };
  categorias: { id: string; slug: string; nombre: string; productos: ProductoDto[] }[];
}

export interface LineInput {
  skuId: string;
  cantidad?: number;
  gramos?: number;
}

export interface QuoteLine {
  skuId: string;
  productoId: string;
  nombre: string;
  presentacion: string;
  modalidad: Modalidad;
  cantidad: number | null;
  gramos: number | null;
  estimadoCents: number;
  autorizadoCents: number;
}

export interface EntregaEstimada {
  minMin: number;
  maxMin: number;
  nivelCarga: 'NORMAL' | 'ALTA';
  sinRepartidores: boolean;
}

/** La única razón para no repartir es estar fuera de la cobertura de 4 km: ni la carga ni el monto rechazan una entrega. */
export type EntregaQuote =
  | { ok: true; ubicacionId: string; nombre: string; distanciaKm: number; tarifaCents: number }
  | { ok: false; reason: string; masCercana?: { ubicacionId: string; nombre: string; distanciaKm: number } }
  | null;

export interface QuoteDto {
  /** Tienda efectiva: la elegida (recojo) o la que cubre la dirección (entrega). */
  ubicacionId: string;
  tienda: { id: string; nombre: string; ciudad: string };
  distanciaKm: number | null;
  /** Tiempo aproximado de entrega (rango en minutos). Solo en entregas dentro de cobertura. */
  entregaEstimada: EntregaEstimada | null;
  lineas: QuoteLine[];
  subtotalCents: number;
  tarifaEntregaCents: number;
  propinaCents: number;
  totalEstimadoCents: number;
  totalAutorizadoCents: number;
  entrega: EntregaQuote;
  problemas: { skuId: string; motivo: string }[];
  puedePedir: boolean;
}

export interface PedidoLinea {
  id: string;
  skuId: string;
  nombre: string;
  presentacion: string;
  modalidad: Modalidad;
  cantidad: number | null;
  gramosSolicitados: number | null;
  gramosFinales: number | null;
  estimadoCents: number;
  finalCents: number | null;
  estado: 'PENDIENTE' | 'LISTA' | 'FALTANTE';
}

export interface PedidoDto {
  id: string;
  numero: number;
  estado: string;
  modo: Modo;
  tienda: { id: string; nombre: string; ciudad: string } | null;
  cliente?: { nombre: string; telefono: string };
  direccion: { linea: string; referencia?: string } | null;
  totales: {
    subtotalEstimadoCents: number;
    tarifaEntregaCents: number;
    descuentoCents: number;
    propinaCents: number;
    totalEstimadoCents: number;
    totalAutorizadoCents: number;
    totalFinalCents: number | null;
  };
  lineas: PedidoLinea[];
  pago: { estado: string; motivo?: string; capturadoCents: number; reembolsadoCents: number } | null;
  entrega: {
    repartidor: string | null;
    despachadoEn: string | null;
    entregadoEn: string | null;
    limiteFrioEn: string | null;
    /** Pasó de la meta de 20 min (semáforo ámbar, no una falla). */
    demorado: boolean;
    nivel: 'EN_TIEMPO' | 'DEMORADO' | null;
    minutosRestantes: number | null;
  } | null;
  /** Hora aproximada de llegada que se le prometió al cliente (solo entregas). */
  entregaEstimadaEn: string | null;
  pasos: string[];
  pasoActual: number;
  acciones: string[];
  eventos: { evento: string; en: string; actor: string }[];
  creadoEn: string;
}

export interface PedidoResumen {
  id: string;
  numero: number;
  estado: string;
  modo: Modo;
  cliente: string;
  lineas: number;
  pendientes: number;
  resumen: string[];
  totalEstimadoCents: number;
  totalFinalCents: number | null;
  pasoActual: number;
  creadoEn: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  telefono: string;
  rol: Rol;
  ubicacionId: string | null;
}

export interface RepartoCard {
  id: string;
  numero: number;
  estado: string;
  cliente: string;
  telefono: string;
  direccion: { linea: string; referencia?: string } | null;
  resumen: string[];
  totalFinalCents: number | null;
  limiteFrioEn: string | null;
  minutosRestantes: number | null;
  demorado: boolean;
}

export interface RepartoDto {
  enTurno: boolean;
  metaViajeMin: number;
  enRuta: RepartoCard[];
  porSalir: RepartoCard[];
}

export interface TiendaRepartoDto {
  repartidores: { id: string; nombre: string; enRuta: number }[];
  sinRepartidores: boolean;
  pedidosPorAlistar: number;
  pedidosEsperandoSalir: number;
  nivelCarga: 'NORMAL' | 'ALTA';
  /** Lo que vería hoy un cliente nuevo. */
  estimadoNuevo: { minMin: number; maxMin: number };
  metaViajeMin: number;
  enRuta: { pedidoId: string; numero: number; repartidor: string | null; limiteFrioEn: string | null; minutosRestantes: number | null; demorado: boolean }[];
  conPromesaVencida: { pedidoId: string; numero: number; prometidoEn: string | null }[];
}

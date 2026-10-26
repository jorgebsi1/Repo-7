import { formatPEN } from '@prolac/domain';

export const money = formatPEN;

export function grams(g: number): string {
  return g >= 1000 ? `${(g / 1000).toString().replace('.', ',')} kg` : `${g} g`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(new Date(iso));
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export const ESTADO_TEXTO: Record<string, { label: string; tono: 'info' | 'ok' | 'warn' | 'bad' | 'neutral' }> = {
  CREADO: { label: 'Creado', tono: 'neutral' },
  PAGO_PENDIENTE: { label: 'Pago pendiente', tono: 'warn' },
  PAGO_FALLIDO: { label: 'Pago rechazado', tono: 'bad' },
  CONFIRMADO: { label: 'Confirmado', tono: 'info' },
  ALISTANDO: { label: 'Alistando', tono: 'info' },
  FALTANTE: { label: 'Con faltante', tono: 'warn' },
  EMPACADO: { label: 'Empacado', tono: 'info' },
  LISTO_RECOJO: { label: 'Listo para recoger', tono: 'ok' },
  EN_CAMINO: { label: 'En camino', tono: 'info' },
  ENTREGADO: { label: 'Entregado', tono: 'ok' },
  NO_RECOGIDO: { label: 'No recogido', tono: 'bad' },
  FALLIDO_ENTREGA: { label: 'Entrega fallida', tono: 'bad' },
  CANCELADO: { label: 'Cancelado', tono: 'neutral' },
  REEMBOLSADO: { label: 'Reembolsado', tono: 'neutral' },
};

/** Mensaje claro para el cliente a partir de los códigos de error de la API. */
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e && 'message' in e) {
    const err = e as { code: string; message: string; body?: Record<string, unknown> };
    switch (err.code) {
      case 'FUERA_DE_ZONA':
        return 'Esa dirección está fuera de nuestra zona de reparto. Prueba con recojo en tienda.';
      case 'BAJO_PEDIDO_MINIMO':
        return `El pedido mínimo para entrega es ${money(Number(err.body?.pedidoMinimoCents ?? 0))}.`;
      case 'PRODUCTO_NO_DISPONIBLE':
      case 'SIN_STOCK':
        return 'Algún producto ya no está disponible. Revisa tu carrito.';
      case 'NO_AUTENTICADO':
        return 'Inicia sesión para continuar.';
    }
    return err.message;
  }
  return 'Algo salió mal. Inténtalo de nuevo.';
}

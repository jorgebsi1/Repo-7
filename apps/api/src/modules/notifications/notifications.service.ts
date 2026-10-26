import { Injectable, Logger } from '@nestjs/common';

export interface Notificacion {
  clienteId: string;
  plantilla: string;
  datos: Record<string, unknown>;
  en: Date;
}

/**
 * Stub: registra las notificaciones en memoria y en el log.
 * Los canales reales (push, WhatsApp, SMS) se conectan aquí en la fase de acabados.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Notificaciones');
  private readonly enviadas: Notificacion[] = [];

  notify(clienteId: string, plantilla: string, datos: Record<string, unknown> = {}): void {
    this.enviadas.push({ clienteId, plantilla, datos, en: new Date() });
    this.log.log(`${plantilla} → cliente ${clienteId}`);
    if (this.enviadas.length > 500) this.enviadas.shift();
  }

  list(clienteId?: string): Notificacion[] {
    return clienteId ? this.enviadas.filter((n) => n.clienteId === clienteId) : [...this.enviadas];
  }
}

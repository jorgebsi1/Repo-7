import { ConflictException, NotFoundException } from '@nestjs/common';

export const conflict = (code: string, message: string, extra: Record<string, unknown> = {}) =>
  new ConflictException({ code, message, ...extra });

export const notFound = (what: string) => new NotFoundException({ code: 'NO_ENCONTRADO', message: `${what} no existe` });

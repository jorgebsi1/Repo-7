import { BadRequestException } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/** Valida con zod y responde 400 con el detalle de los campos inválidos. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new BadRequestException({
      code: 'DATOS_INVALIDOS',
      message: 'Revisa los datos enviados',
      campos: r.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    });
  }
  return r.data;
}

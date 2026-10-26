import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { z } from 'zod';
import { signToken, type AuthUser } from '../../common/auth';
import { AuthGuard, CurrentUser } from '../../common/auth.guard';
import { DB } from '../../common/tokens';
import { parse } from '../../common/zod';
import type { Db } from '../../db/client';
import { cliente } from '../../db/schema';

const loginSchema = z.object({
  telefono: z.string().regex(/^\+?\d{9,15}$/, 'Teléfono inválido'),
  codigo: z.string().min(4).max(10),
  nombre: z.string().min(2).max(80).optional(),
});

/**
 * LOGIN DE DESARROLLO: acepta el código fijo DEV_LOGIN_CODE. No es seguridad real.
 * Se reemplaza por verificación por SMS/WhatsApp en la fase de acabados.
 */
@ApiTags('cuenta')
@Controller('v1')
export class AccountsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Post('auth/login')
  async login(@Body() body: unknown) {
    const b = parse(loginSchema, body);
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_LOGIN !== 'true') {
      throw new UnauthorizedException({ code: 'LOGIN_DEV_DESHABILITADO', message: 'El login de desarrollo está deshabilitado' });
    }
    if (b.codigo !== (process.env.DEV_LOGIN_CODE ?? '123456')) {
      throw new UnauthorizedException({ code: 'CODIGO_INVALIDO', message: 'Código incorrecto' });
    }
    let [c] = await this.db.select().from(cliente).where(eq(cliente.telefono, b.telefono));
    if (!c) [c] = await this.db.insert(cliente).values({ nombre: b.nombre ?? 'Cliente', telefono: b.telefono, rol: 'cliente' }).returning();
    const user: AuthUser = { id: c!.id, rol: c!.rol, ubicacionId: c!.ubicacionId };
    return { token: signToken(user), usuario: { id: c!.id, nombre: c!.nombre, telefono: c!.telefono, rol: c!.rol, ubicacionId: c!.ubicacionId } };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const [c] = await this.db.select().from(cliente).where(eq(cliente.id, user.id));
    return { id: user.id, rol: user.rol, ubicacionId: user.ubicacionId, nombre: c?.nombre, telefono: c?.telefono };
  }
}

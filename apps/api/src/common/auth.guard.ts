import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyToken, type AuthUser, type Rol } from './auth';

const ROLES_KEY = 'roles';
/** Restringe una ruta a ciertos roles. Sin este decorador, basta con estar autenticado. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    // EventSource (SSE) no puede enviar cabeceras: se acepta ?token= solo para rutas de stream.
    const queryToken: string | undefined = typeof req.query?.token === 'string' ? req.query.token : undefined;
    const raw = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;
    const user = raw ? verifyToken(raw) : null;
    if (!user) throw new UnauthorizedException({ code: 'NO_AUTENTICADO', message: 'Inicia sesión para continuar' });
    const roles = this.reflector.get<Rol[] | undefined>(ROLES_KEY, ctx.getHandler());
    if (roles && !roles.includes(user.rol)) {
      throw new ForbiddenException({ code: 'ROL_NO_PERMITIDO', message: 'No tienes permiso para esta acción' });
    }
    req.user = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

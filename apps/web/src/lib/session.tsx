'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Usuario } from './types';

interface SessionCtx {
  user: Usuario | null;
  ready: boolean;
  login: (telefono: string, codigo: string, nombre?: string) => Promise<Usuario>;
  logout: () => void;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('prolac.user');
      if (raw && localStorage.getItem('prolac.token')) setUser(JSON.parse(raw) as Usuario);
    } catch {
      /* almacenamiento no disponible: se sigue como invitado */
    }
    setReady(true);
  }, []);

  const login = useCallback(async (telefono: string, codigo: string, nombre?: string) => {
    const r = await api<{ token: string; usuario: Usuario }>('/v1/auth/login', { body: { telefono, codigo, nombre }, token: null });
    try {
      localStorage.setItem('prolac.token', r.token);
      localStorage.setItem('prolac.user', JSON.stringify(r.usuario));
    } catch {
      /* sin almacenamiento: la sesión dura mientras la pestaña */
    }
    setUser(r.usuario);
    return r.usuario;
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('prolac.token');
      localStorage.removeItem('prolac.user');
    } catch {
      /* nada */
    }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, login, logout }), [user, ready, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession fuera de SessionProvider');
  return v;
}

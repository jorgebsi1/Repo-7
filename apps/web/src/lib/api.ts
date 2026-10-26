export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem('prolac.token');
  } catch {
    return null;
  }
}

interface Opts {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
}

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const token = opts.token === undefined ? getToken() : opts.token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'SIN_CONEXION', 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, data.code ?? 'ERROR', data.message ?? 'Algo salió mal', data);
  return data as T;
}

/** URL de un stream SSE autenticado (EventSource no admite cabeceras, se usa ?token=). */
export function streamUrl(path: string): string | null {
  const t = getToken();
  return t ? `${API_URL}${path}?token=${encodeURIComponent(t)}` : null;
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Card, ErrorBox } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';

const DEMO_USERS = [
  { label: 'Cliente de prueba', telefono: '+51900000001' },
  { label: 'Tienda Las Casuarinas (panel)', telefono: '+51900000002' },
  { label: 'Repartidor 1 de prueba (vista de reparto)', telefono: '+51900000003' },
  { label: 'Repartidor 2 de prueba', telefono: '+51900000005' },
  { label: 'Administrador de prueba', telefono: '+51900000004' },
];

function CuentaInner() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/';
  const { user, login, logout } = useSession();
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const entrar = async (tel: string, cod: string, nom?: string) => {
    setBusy(true);
    setError(null);
    try {
      const u = await login(tel, cod, nom);
      router.replace(u.rol === 'tienda' || u.rol === 'admin' ? '/panel' : u.rol === 'repartidor' ? '/reparto' : next);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="pt-2 text-2xl font-bold">Tu cuenta</h1>
        <Card className="p-4">
          <p className="font-semibold">{user.nombre}</p>
          <p className="text-ink-soft">{user.telefono}</p>
        </Card>
        {user.rol === 'repartidor' && (
          <Link href="/reparto" className="flex min-h-12 items-center justify-center rounded-control bg-brand font-semibold text-white">Ir a mi reparto</Link>
        )}
        {(user.rol === 'tienda' || user.rol === 'admin') && (
          <Link href="/panel" className="flex min-h-12 items-center justify-center rounded-control bg-brand font-semibold text-white">Ir al panel de tienda</Link>
        )}
        <Button block variant="ghost" onClick={logout}>Cerrar sesión</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <h1 className="pt-2 text-2xl font-bold">Ingresa a Prolac</h1>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void entrar(telefono, codigo, nombre || undefined); }}>
        <label className="block text-sm font-medium">Celular
          <input inputMode="tel" autoComplete="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+51 9XX XXX XXX" className="mt-1 min-h-12 w-full rounded-control border border-line bg-surface px-3 text-base" />
        </label>
        <label className="block text-sm font-medium">Tu nombre (si eres nuevo)
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 min-h-12 w-full rounded-control border border-line bg-surface px-3 text-base" />
        </label>
        <label className="block text-sm font-medium">Código
          <input inputMode="numeric" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="123456" className="mt-1 min-h-12 w-full rounded-control border border-line bg-surface px-3 text-base" />
        </label>
        <p className="text-xs text-ink-soft">Acceso de desarrollo: el código es 123456. El envío real del código por SMS o WhatsApp llega en los acabados.</p>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Button type="submit" block disabled={busy || !telefono || !codigo}>Continuar</Button>
      </form>

      <section className="space-y-2 border-t border-line pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-soft">Entrar como usuario de prueba</h2>
        {DEMO_USERS.map((u) => (
          <Button key={u.telefono} block variant="ghost" disabled={busy} onClick={() => entrar(u.telefono, '123456')}>{u.label}</Button>
        ))}
      </section>
    </div>
  );
}

export default function Cuenta() {
  return (
    <Suspense>
      <CuentaInner />
    </Suspense>
  );
}

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  getAdminToken, setAdminToken, clearAdminToken, staffLogin,
} from '../lib/admin';
import { kzPhoneE164 } from '../lib/phone';

interface AdminCtx { signOut: () => void }
const Ctx = createContext<AdminCtx>({ signOut: () => {} });
export function useAdmin() { return useContext(Ctx); }

const NAV = [
  { href: '/admin/stores', label: 'Магазины' },
  { href: '/admin/catalog', label: 'Каталог' },
  { href: '/admin/orders', label: 'Заказы' },
  { href: '/admin/analytics', label: 'Аналитика' },
  { href: '/admin/partners', label: 'Заявки' },
  { href: '/admin/staff', label: 'Сотрудники' },
];

/** Общая оболочка админки: вход по OTP, верхняя навигация, выход. */
export default function AdminShell({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => { setAuthed(!!getAdminToken()); }, []);

  function signOut() { clearAdminToken(); setAuthed(false); }

  if (authed === null) return <div style={{ padding: 40 }} />;
  if (!authed) return <AdminLogin onDone={() => setAuthed(true)} />;

  return (
    <Ctx.Provider value={{ signOut }}>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 16, height: 60, maxWidth: 920 }}>
          <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--carrot)' }}>Kartop</span>
          <nav style={{ display: 'flex', gap: 6 }}>
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link key={n.href} href={n.href}
                  style={{
                    padding: '8px 14px', borderRadius: 999, fontSize: 15, fontWeight: 700, textDecoration: 'none',
                    color: active ? '#fff' : 'var(--ink-60)', background: active ? 'var(--carrot)' : 'transparent',
                  }}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <button className="btn btn-ghost" onClick={signOut} style={{ marginLeft: 'auto' }}>Выйти</button>
        </div>
      </header>
      {children}
    </Ctx.Provider>
  );
}

function AdminLogin({ onDone }: { onDone: () => void }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Телефон нормализуем, email — как есть.
  const ident = login.includes('@') ? login.trim() : (login ? kzPhoneE164(login) : '');

  async function doLogin() {
    if (!password || !login) return;
    setErr(null); setBusy(true);
    try {
      const token = await staffLogin(ident, password);
      setAdminToken(token);
      onDone();
    } catch (e) {
      clearAdminToken();
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  const input: React.CSSProperties = { width: '100%', padding: '13px 14px', fontSize: 16, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit' };

  return (
    <div className="container" style={{ maxWidth: 400, padding: '64px 20px' }}>
      <div style={{ fontWeight: 900, fontSize: 28, color: 'var(--carrot)', marginBottom: 4 }}>Kartop</div>
      <div className="muted" style={{ marginBottom: 28 }}>Админка платформы</div>
      <label style={{ fontWeight: 700, fontSize: 14, display: 'block', marginBottom: 6 }}>Телефон или email</label>
      <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username"
        placeholder="+7 701 234 56 78 или you@mail.com" style={input}
        onKeyDown={(e) => { if (e.key === 'Enter') doLogin(); }} />
      <label style={{ fontWeight: 700, fontSize: 14, display: 'block', margin: '14px 0 6px' }}>Пароль</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
        placeholder="Ваш пароль" style={input}
        onKeyDown={(e) => { if (e.key === 'Enter') doLogin(); }} />
      <button className="btn btn-primary btn-block" disabled={busy || !password || !login} onClick={doLogin} style={{ marginTop: 16, height: 48 }}>
        {busy ? 'Входим…' : 'Войти'}
      </button>
      {err ? <p style={{ color: 'var(--sale)', fontSize: 14, marginTop: 12 }}>{err}</p> : null}
    </div>
  );
}

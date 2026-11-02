'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  getAdminToken, setAdminToken, clearAdminToken,
  requestAdminOtp, verifyAdminOtp, listLeads, UnauthorizedError,
} from '../lib/admin';

interface AdminCtx { signOut: () => void }
const Ctx = createContext<AdminCtx>({ signOut: () => {} });
export function useAdmin() { return useContext(Ctx); }

const NAV = [
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
  const [phone, setPhone] = useState('+7');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function request() {
    setErr(null); setBusy(true);
    try { await requestAdminOtp(phone.trim()); setSent(true); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  async function verify() {
    setErr(null); setBusy(true);
    try {
      const token = await verifyAdminOtp(phone.trim(), code.trim());
      setAdminToken(token);
      await listLeads('NEW'); // проверка, что номер — сотрудник платформы (иначе 403)
      onDone();
    } catch (e) {
      if (e instanceof UnauthorizedError) { clearAdminToken(); setErr('Этот номер не сотрудник платформы'); }
      else setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  const input: React.CSSProperties = { width: '100%', padding: '13px 14px', fontSize: 16, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit' };

  return (
    <div className="container" style={{ maxWidth: 400, padding: '64px 20px' }}>
      <div style={{ fontWeight: 900, fontSize: 28, color: 'var(--carrot)', marginBottom: 4 }}>Kartop</div>
      <div className="muted" style={{ marginBottom: 28 }}>Админка платформы</div>
      {!sent ? (
        <>
          <label style={{ fontWeight: 700, fontSize: 14, display: 'block', marginBottom: 6 }}>Телефон сотрудника</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+77011234567" style={input} />
          <button className="btn btn-primary btn-block" disabled={busy} onClick={request} style={{ marginTop: 16, height: 48 }}>
            {busy ? 'Отправляем…' : 'Получить код'}
          </button>
        </>
      ) : (
        <>
          <div className="muted" style={{ marginBottom: 10 }}>Код отправлен на {phone}</div>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="••••••"
            style={{ ...input, textAlign: 'center', fontSize: 26, letterSpacing: 8, fontWeight: 800 }} />
          <button className="btn btn-primary btn-block" disabled={busy} onClick={verify} style={{ marginTop: 16, height: 48 }}>
            {busy ? 'Проверяем…' : 'Войти'}
          </button>
          <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => setSent(false)} style={{ marginTop: 8 }}>
            Изменить номер
          </button>
        </>
      )}
      {err ? <p style={{ color: 'var(--sale)', fontSize: 14, marginTop: 12 }}>{err}</p> : null}
    </div>
  );
}

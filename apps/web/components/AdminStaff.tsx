'use client';

import { useCallback, useEffect, useState } from 'react';
import { Staff, StaffRole, listStaff, createStaff, setStaffRole, setStaffPassword, UnauthorizedError } from '../lib/admin';
import { useAdmin } from './AdminShell';
import { isValidKzPhone, kzPhoneE164, formatKzPhone } from '../lib/phone';
import PhoneInput from './PhoneInput';

const ROLE_META: Record<StaffRole, { label: string; color: string; bg: string; hint: string }> = {
  PLATFORM_ADMIN: { label: 'Администратор', color: '#fff', bg: 'var(--carrot)', hint: 'Полный доступ: заявки и управление сотрудниками.' },
  SUPPORT:        { label: 'Поддержка',     color: 'var(--leaf)', bg: 'var(--leaf-50)', hint: 'Работа с заявками. Без управления сотрудниками.' },
};

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return iso; }
}

export default function AdminStaff() {
  const { signOut } = useAdmin();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [noAccess, setNoAccess] = useState(false);

  // форма создания
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+7');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole>('SUPPORT');
  const [adding, setAdding] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try { setStaff(await listStaff()); }
    catch (e) {
      // 403 здесь = сотрудник не администратор (SUPPORT): показываем мягкое сообщение, не разлогиниваем.
      if (e instanceof UnauthorizedError) setNoAccess(true);
      else setErr((e as Error).message);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const phoneOk = isValidKzPhone(phone);
  const canAdd = name.trim().length >= 2 && phoneOk && password.length >= 6 && !adding;

  async function add() {
    if (!canAdd) return;
    setFormErr(null); setAdding(true);
    try {
      await createStaff(name.trim(), kzPhoneE164(phone), password, role);
      setName(''); setPhone('+7'); setPassword(''); setRole('SUPPORT');
      await load();
    } catch (e) {
      if (e instanceof UnauthorizedError) setNoAccess(true);
      else setFormErr((e as Error).message);
    } finally { setAdding(false); }
  }

  async function change(id: string, newRole: StaffRole | 'NONE') {
    setSavingId(id); setErr(null);
    try { await setStaffRole(id, newRole); await load(); }
    catch (e) { if (e instanceof UnauthorizedError) setNoAccess(true); else setErr((e as Error).message); }
    finally { setSavingId(null); }
  }

  async function resetPwd(id: string) {
    const pwd = window.prompt('Новый пароль сотрудника (минимум 6 символов):');
    if (pwd === null) return;
    if (pwd.length < 6) { setErr('Пароль — минимум 6 символов'); return; }
    setSavingId(id); setErr(null);
    try { await setStaffPassword(id, pwd); window.alert('Пароль обновлён'); }
    catch (e) { if (e instanceof UnauthorizedError) setNoAccess(true); else setErr((e as Error).message); }
    finally { setSavingId(null); }
  }

  if (noAccess) {
    return (
      <div className="container" style={{ padding: '40px 20px', maxWidth: 920 }}>
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>Доступ только для администратора</div>
          <p className="muted" style={{ margin: 0 }}>Управлять сотрудниками может только роль «Администратор».</p>
        </div>
      </div>
    );
  }

  const input: React.CSSProperties = { width: '100%', padding: '12px 14px', fontSize: 16, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit' };

  return (
    <div className="container" style={{ padding: '24px 20px 56px', maxWidth: 920 }}>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Сотрудники</h1>
      <p className="muted" style={{ margin: '0 0 20px', fontSize: 15 }}>
        Создайте доступ подчинённым. Вход — по их телефону (код в приложении/SMS), пароль не нужен.
      </p>

      {/* Форма добавления */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>Добавить сотрудника</div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6 }}>Имя</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя сотрудника" style={input} />
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6 }}>Телефон</label>
            <PhoneInput value={phone} onChange={setPhone} style={input} />
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6 }}>Пароль</label>
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="минимум 6 символов" style={input} autoComplete="new-password" />
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6 }}>Роль</label>
            <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} style={{ ...input, cursor: 'pointer' }}>
              <option value="SUPPORT">Поддержка</option>
              <option value="PLATFORM_ADMIN">Администратор</option>
            </select>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>
          Сотрудник войдёт по своему телефону и этому паролю на этой же странице. Пароль можно потом сменить.
        </p>
        <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }}>{ROLE_META[role].hint}</p>
        {formErr ? <p style={{ color: 'var(--sale)', fontSize: 14, margin: '10px 0 0' }}>{formErr}</p> : null}
        <button className="btn btn-primary" disabled={!canAdd} onClick={add} style={{ marginTop: 14, height: 46, opacity: canAdd ? 1 : 0.6 }}>
          {adding ? 'Добавляем…' : 'Добавить сотрудника'}
        </button>
      </div>

      {err ? <p style={{ color: 'var(--sale)' }}>{err}</p> : null}
      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {staff.map((s) => {
            const m = ROLE_META[s.platformRole];
            return (
              <div key={s.id} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{s.name || '—'}</div>
                  <div className="muted" style={{ fontSize: 14 }}>{formatKzPhone(s.phone)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>с {fmtDate(s.createdAt)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: m.color, background: m.bg, whiteSpace: 'nowrap' }}>
                    {m.label}
                  </span>
                  <select
                    value={s.platformRole}
                    disabled={savingId === s.id}
                    onChange={(e) => change(s.id, e.target.value as StaffRole | 'NONE')}
                    style={{ padding: '8px 10px', fontSize: 14, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer' }}
                  >
                    <option value="SUPPORT">Поддержка</option>
                    <option value="PLATFORM_ADMIN">Администратор</option>
                    <option value="NONE">Отозвать доступ</option>
                  </select>
                  <button className="btn btn-ghost" disabled={savingId === s.id}
                    onClick={() => resetPwd(s.id)} style={{ padding: '8px 12px', fontSize: 13 }}>
                    Сменить пароль
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

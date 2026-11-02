'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PartnerLead, PartnerLeadStatus, listLeads, setLeadStatus,
  getAdminToken, setAdminToken, clearAdminToken,
  requestAdminOtp, verifyAdminOtp, UnauthorizedError,
} from '../lib/admin';

const STATUS_META: Record<PartnerLeadStatus, { label: string; color: string; bg: string }> = {
  NEW:       { label: 'Новая',     color: 'var(--carrot-600)', bg: 'var(--carrot-50)' },
  CONTACTED: { label: 'Связались', color: 'var(--leaf)',       bg: 'var(--leaf-50, #E9F2EB)' },
  CONVERTED: { label: 'Завели',    color: '#fff',              bg: 'var(--leaf)' },
  REJECTED:  { label: 'Отказ',     color: 'var(--ink-60)',     bg: 'var(--line)' },
};
const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'ALL', label: 'Все' },
  { key: 'NEW', label: 'Новые' },
  { key: 'CONTACTED', label: 'Связались' },
  { key: 'CONVERTED', label: 'Завели' },
  { key: 'REJECTED', label: 'Отказ' },
];

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function AdminLeads() {
  const [authed, setAuthed] = useState<boolean | null>(null); // null = ещё не знаем

  useEffect(() => { setAuthed(!!getAdminToken()); }, []);

  if (authed === null) return <div className="container" style={{ padding: 40 }} />;
  if (!authed) return <AdminLogin onDone={() => setAuthed(true)} />;
  return <LeadsTable onUnauth={() => { clearAdminToken(); setAuthed(false); }} />;
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
      // Проверяем, что это сотрудник платформы (иначе эндпоинт отдаст 403).
      await listLeads('NEW');
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

function LeadsTable({ onUnauth }: { onUnauth: () => void }) {
  const [filter, setFilter] = useState('ALL');
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async (f: string) => {
    setLoading(true); setErr(null);
    try { setLeads(await listLeads(f)); }
    catch (e) { if (e instanceof UnauthorizedError) onUnauth(); else setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [onUnauth]);

  useEffect(() => { load(filter); }, [filter, load]);

  async function change(id: string, status: PartnerLeadStatus) {
    setSavingId(id); setErr(null);
    try {
      await setLeadStatus(id, status);
      // Обновляем локально; если фильтр не «Все» — перезагружаем список.
      if (filter === 'ALL') setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
      else await load(filter);
    } catch (e) {
      if (e instanceof UnauthorizedError) onUnauth(); else setErr((e as Error).message);
    } finally { setSavingId(null); }
  }

  return (
    <div className="container" style={{ padding: '24px 20px 56px', maxWidth: 920 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>Заявки партнёров</h1>
        <button className="btn btn-ghost" onClick={onUnauth}>Выйти</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={filter === f.key ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ padding: '8px 14px', fontSize: 14 }}>
            {f.label}
          </button>
        ))}
        <button className="btn btn-ghost" onClick={() => load(filter)} style={{ padding: '8px 14px', fontSize: 14, marginLeft: 'auto' }}>
          ↻ Обновить
        </button>
      </div>

      {err ? <p style={{ color: 'var(--sale)' }}>{err}</p> : null}
      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : leads.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div className="muted">Заявок пока нет.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {leads.map((l) => {
            const m = STATUS_META[l.status];
            return (
              <div key={l.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 200 }}>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>{l.name}</div>
                    <a href={`tel:${l.phone}`} style={{ color: 'var(--carrot-600)', fontWeight: 600, textDecoration: 'none' }}>{l.phone}</a>
                    {l.company ? <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>{l.company}</div> : null}
                    {l.twogisUrl ? (
                      <div style={{ fontSize: 14, marginTop: 2 }}>
                        <a href={/^https?:\/\//.test(l.twogisUrl) ? l.twogisUrl : `https://${l.twogisUrl}`}
                          target="_blank" rel="noreferrer" style={{ color: 'var(--leaf)' }}>2ГИС ↗</a>
                      </div>
                    ) : null}
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {fmtDate(l.createdAt)} · {l.source === 'merchant_app' ? 'из приложения' : 'с сайта'}
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: m.color, background: m.bg, whiteSpace: 'nowrap' }}>
                    {m.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {(['CONTACTED', 'CONVERTED', 'REJECTED', 'NEW'] as PartnerLeadStatus[])
                    .filter((s) => s !== l.status)
                    .map((s) => (
                      <button key={s} className="btn btn-ghost" disabled={savingId === l.id}
                        onClick={() => change(l.id, s)}
                        style={{ padding: '6px 12px', fontSize: 13 }}>
                        {STATUS_META[s].label}
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PartnerLead, PartnerLeadStatus, listLeads, setLeadStatus, UnauthorizedError } from '../lib/admin';
import { useAdmin } from './AdminShell';
import { formatKzPhone } from '../lib/phone';

const STATUS_META: Record<PartnerLeadStatus, { label: string; color: string; bg: string }> = {
  NEW:       { label: 'Новая',     color: 'var(--carrot-600)', bg: 'var(--carrot-50)' },
  CONTACTED: { label: 'Связались', color: 'var(--leaf)',       bg: 'var(--leaf-50)' },
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
  const { signOut } = useAdmin();
  const [filter, setFilter] = useState('ALL');
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async (f: string) => {
    setLoading(true); setErr(null);
    try { setLeads(await listLeads(f)); }
    catch (e) { if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [signOut]);

  useEffect(() => { load(filter); }, [filter, load]);

  async function change(id: string, status: PartnerLeadStatus) {
    setSavingId(id); setErr(null);
    try {
      await setLeadStatus(id, status);
      if (filter === 'ALL') setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
      else await load(filter);
    } catch (e) {
      if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message);
    } finally { setSavingId(null); }
  }

  return (
    <div className="container" style={{ padding: '24px 20px 56px', maxWidth: 920 }}>
      <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>Заявки партнёров</h1>

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
                    <a href={`tel:${l.phone}`} style={{ color: 'var(--carrot-600)', fontWeight: 600, textDecoration: 'none' }}>{formatKzPhone(l.phone)}</a>
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

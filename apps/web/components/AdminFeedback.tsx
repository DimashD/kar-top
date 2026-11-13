'use client';

import { useCallback, useEffect, useState } from 'react';
import { Feedback, FeedbackKind, FeedbackStatus, listFeedback, setFeedbackStatus, UnauthorizedError } from '../lib/admin';
import { useAdmin } from './AdminShell';
import { formatKzPhone } from '../lib/phone';

const KIND: Record<FeedbackKind, string> = { IDEA: '💡 Идея', PROBLEM: '⚠️ Проблема', COMPLAINT: '😠 Жалоба', PRAISE: '❤️ Похвала', OTHER: '💬 Другое' };
const STATUS_META: Record<FeedbackStatus, { label: string; color: string; bg: string }> = {
  NEW:         { label: 'Новый',    color: 'var(--carrot-600)', bg: 'var(--carrot-50)' },
  IN_PROGRESS: { label: 'В работе', color: 'var(--leaf)',       bg: 'var(--leaf-50)' },
  DONE:        { label: 'Готово',   color: 'var(--ink-60)',     bg: 'var(--line)' },
};
const STATUS_FILTERS = [{ key: 'ALL', label: 'Все' }, { key: 'NEW', label: 'Новые' }, { key: 'IN_PROGRESS', label: 'В работе' }, { key: 'DONE', label: 'Готово' }];
const SOURCE_FILTERS = [{ key: 'ALL', label: 'Все' }, { key: 'CUSTOMER', label: 'Покупатели' }, { key: 'MERCHANT', label: 'Магазины' }];

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

/** Обратная связь о работе сервиса от покупателей и магазинов. Предложения товаров — в «Каталог → Заявки». */
export default function AdminFeedback() {
  const { signOut } = useAdmin();
  const [status, setStatus] = useState('NEW');
  const [source, setSource] = useState('ALL');
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try { setItems(await listFeedback(status, source)); }
    catch (e) { if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [status, source, signOut]);

  useEffect(() => { load(); }, [load]);

  async function change(id: string, s: FeedbackStatus) {
    try {
      await setFeedbackStatus(id, s);
      setItems((xs) => (status === 'ALL' ? xs.map((x) => (x.id === id ? { ...x, status: s } : x)) : xs.filter((x) => x.id !== id)));
    } catch (e) { if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message); }
  }

  const chips = (list: { key: string; label: string }[], value: string, set: (v: string) => void) => list.map((f) => (
    <button key={f.key} onClick={() => set(f.key)} className={value === f.key ? 'btn btn-primary' : 'btn btn-ghost'} style={{ padding: '8px 14px', fontSize: 14 }}>{f.label}</button>
  ));

  return (
    <div className="container" style={{ padding: '24px 20px 56px', maxWidth: 1120 }}>
      <h1 style={{ fontSize: 26, margin: '0 0 16px' }}>Обратная связь</h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>{chips(STATUS_FILTERS, status, setStatus)}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {chips(SOURCE_FILTERS, source, setSource)}
        <button className="btn btn-ghost" onClick={load} style={{ padding: '8px 14px', fontSize: 14, marginLeft: 'auto' }}>↻ Обновить</button>
      </div>
      {err ? <p style={{ color: 'var(--sale)' }}>{err}</p> : null}
      {loading ? <p className="muted">Загрузка…</p> : items.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}><div className="muted">Сообщений нет.</div></div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((f) => {
            const m = STATUS_META[f.status];
            return (
              <div key={f.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 800 }}>{KIND[f.kind]} · {f.source === 'MERCHANT' ? 'магазин' : 'покупатель'}{f.storeSlug ? ` · ${f.storeSlug}` : ''}</div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: m.color, background: m.bg }}>{m.label}</span>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', margin: '10px 0' }}>{f.text}</p>
                <div className="muted" style={{ fontSize: 13 }}>
                  {fmtDate(f.createdAt)}
                  {f.phone ? <> · <a href={`tel:${f.phone}`} style={{ color: 'var(--carrot-600)' }}>{formatKzPhone(f.phone)}</a></> : ' · без номера'}
                  {f.page ? ` · ${f.page}` : ''}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  {(['IN_PROGRESS', 'DONE', 'NEW'] as FeedbackStatus[]).filter((s) => s !== f.status).map((s) => (
                    <button key={s} className="btn btn-ghost" onClick={() => change(f.id, s)} style={{ padding: '6px 12px', fontSize: 13 }}>{STATUS_META[s].label}</button>
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

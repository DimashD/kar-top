'use client';

import { useEffect, useState } from 'react';
import { StoreOffer, storeOffer, markStoreOffer } from '../lib/admin';
import { formatKzPhone } from '../lib/phone';

const METHOD: Record<string, string> = { SMS: 'в приложении, код из SMS', ECP: 'ЭЦП', PAPER: 'на бумаге', CLICK: 'нажатием' };

/** Блок «Договор» в карточке магазина: принята ли оферта и отметка о подписании ЭЦП / на бумаге. */
export default function AdminStoreContract({ storeId }: { storeId: string }) {
  const [o, setO] = useState<StoreOffer | null>(null);
  const [form, setForm] = useState(false);
  const [method, setMethod] = useState<'ECP' | 'PAPER'>('PAPER');
  const [name, setName] = useState('');
  const [bin, setBin] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { storeOffer(storeId).then((x) => { setO(x); setName(x.legalName ?? ''); setBin(x.legalBin ?? ''); }).catch(() => {}); }, [storeId]);
  if (!o) return null;

  async function save() {
    setErr(null); setBusy(true);
    try {
      const x = await markStoreOffer(storeId, { method, legalName: name.trim() || undefined, bin: bin || undefined, note: note.trim() || undefined });
      setO(x); setForm(false); setNote('');
    } catch (e) {
      setErr((e as Error).message || 'Не удалось сохранить');
    } finally { setBusy(false); }
  }

  const l = o.last;
  const input: React.CSSProperties = { padding: '8px 10px', fontSize: 14, border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'inherit', minWidth: 0 };
  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: o.accepted ? 'var(--leaf-50)' : '#FCF4E6', fontSize: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong>Договор:</strong>
        {o.accepted && l ? (
          <span>принят {new Date(l.acceptedAt).toLocaleString('ru-RU')} · {METHOD[l.method] ?? l.method}{l.by ? ` · ${l.by.name ? `${l.by.name}, ` : ''}${formatKzPhone(l.by.phone)}` : ''}</span>
        ) : l ? <span>принята старая редакция ({l.version}), нужна {o.version}</span> : <span>не принят</span>}
        {!form ? <button className="btn btn-ghost" onClick={() => setForm(true)} style={{ padding: '4px 10px', fontSize: 13, marginLeft: 'auto' }}>Отметить ЭЦП / бумагу</button> : null}
      </div>
      {o.legalName ? <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{o.legalName}{o.legalBin ? `, ИИН/БИН ${o.legalBin}` : ''}{l?.note ? ` · ${l.note}` : ''}</div> : null}
      {form ? (
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={method} onChange={(e) => setMethod(e.target.value as 'ECP' | 'PAPER')} style={input}>
              <option value="PAPER">Подписан на бумаге</option>
              <option value="ECP">Подписан ЭЦП</option>
            </select>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ИП / ТОО" style={{ ...input, flex: '1 1 180px' }} />
            <input value={bin} onChange={(e) => setBin(e.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" placeholder="ИИН/БИН, 12 цифр" style={{ ...input, width: 160 }} />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Заметка: где оригинал, номер документа в SIGEX…" style={input} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={busy || !name.trim() || bin.length !== 12} onClick={save} style={{ padding: '6px 14px', fontSize: 13 }}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
            <button className="btn btn-ghost" onClick={() => setForm(false)} style={{ padding: '6px 14px', fontSize: 13 }}>Отмена</button>
          </div>
          {err ? <div style={{ color: 'var(--sale)', fontSize: 13 }}>{err}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

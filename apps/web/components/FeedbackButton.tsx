'use client';

import { useState } from 'react';
import { CLIENT_API } from '../lib/api';
import { useT } from './LangProvider';

type Kind = 'IDEA' | 'PROBLEM' | 'COMPLAINT' | 'PRAISE';
const KINDS: Kind[] = ['IDEA', 'PROBLEM', 'COMPLAINT', 'PRAISE'];

// Номер вошедшего покупателя — подставляем, чтобы не вводить заново.
function knownPhone(): string {
  try { return (JSON.parse(localStorage.getItem('kartop:session') ?? 'null') as { phone?: string } | null)?.phone ?? ''; }
  catch { return ''; }
}

/** «Написать в Kartop»: идея, проблема, жалоба или похвала о работе сервиса — уходит команде в админку. */
export default function FeedbackButton({ storeSlug }: { storeSlug?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('IDEA');
  const [text, setText] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function show() { setOpen(true); setSent(false); setErr(null); if (!phone) setPhone(knownPhone()); }

  async function send() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${CLIENT_API}/feedback`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, text: text.trim(), phone: phone.trim() || undefined, storeSlug, page: location.pathname }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(Array.isArray(d.message) ? d.message[0] : d.message || `Ошибка ${r.status}`);
      setSent(true); setText('');
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <p style={{ textAlign: 'center', margin: '28px 0 8px' }}>
        <button type="button" onClick={show} style={{ border: 'none', background: 'transparent', font: 'inherit', fontSize: 14, color: 'var(--ink-60)', textDecoration: 'underline', cursor: 'pointer' }}>
          💬 {t.feedbackLink}
        </button>
      </p>
      {open ? (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,18,0.45)', zIndex: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div role="dialog" aria-label={t.feedbackTitle} onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card)', width: '100%', maxWidth: 520, borderRadius: '22px 22px 0 0', padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{t.feedbackTitle}</div>
            {sent ? (
              <>
                <p style={{ margin: 0 }}>{t.feedbackThanks}</p>
                <button className="btn btn-primary" onClick={() => setOpen(false)} style={{ height: 52 }}>OK</button>
              </>
            ) : (
              <>
                <div className="muted" style={{ fontSize: 14 }}>{t.feedbackHint}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {KINDS.map((k) => (
                    <button key={k} type="button" onClick={() => setKind(k)}
                      style={{ padding: '8px 14px', borderRadius: 999, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                        border: kind === k ? '2px solid var(--carrot)' : '1px solid var(--line)', background: kind === k ? 'var(--carrot-50)' : 'var(--card)', color: 'var(--ink)' }}>
                      {t.feedbackKinds[k]}
                    </button>
                  ))}
                </div>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} placeholder={t.feedbackPlaceholder}
                  style={{ font: 'inherit', fontSize: 16, padding: 12, borderRadius: 12, border: '1px solid var(--line)', resize: 'vertical' }} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" placeholder={t.feedbackPhone}
                  style={{ font: 'inherit', fontSize: 16, padding: 12, borderRadius: 12, border: '1px solid var(--line)' }} />
                {err ? <div style={{ color: 'var(--sale)', fontSize: 14 }}>{err}</div> : null}
                <button className="btn btn-primary" disabled={busy || text.trim().length < 3} onClick={send} style={{ height: 52, fontSize: 16 }}>{t.feedbackSend}</button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

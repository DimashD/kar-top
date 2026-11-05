'use client';

import { useState } from 'react';
import { CLIENT_API } from '../lib/api';
import { isValidKzPhone, kzPhoneE164 } from '../lib/phone';
import PhoneInput from './PhoneInput';
import { useT } from './LangProvider';

/** Заявка «Стать партнёром». Телефон и имя — обязательны; 2ГИС и компания — нет. */
export default function PartnerForm() {
  const t = useT();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [twogis, setTwogis] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const phoneOk = isValidKzPhone(phone);
  const canSubmit = name.trim().length >= 2 && phoneOk && !busy;

  async function submit() {
    if (!canSubmit) return;
    setErr(null); setBusy(true);
    try {
      const r = await fetch(`${CLIENT_API}/partners/apply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: kzPhoneE164(phone),
          company: company.trim() || undefined,
          twogisUrl: twogis.trim() || undefined,
          source: 'web',
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : (data.message || t.applicationError));
      setDone(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card" style={{ padding: 28, textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>✅</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>{t.applicationAccepted}</div>
        <p className="muted" style={{ margin: 0 }}>{t.partnerSuccess}</p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 14px', fontSize: 16, border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 700, fontSize: 14, margin: '14px 0 6px' };

  return (
    <div className="card" style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>{t.partnerFormTitle}</div>
      <p className="muted" style={{ margin: '0 0 8px', fontSize: 15 }}>{t.partnerFormText}</p>

      <label style={labelStyle}>{t.yourName} <span style={{ color: 'var(--sale)' }}>*</span></label>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
        placeholder={t.yourNameHint} style={inputStyle} autoComplete="name" />

      <label style={labelStyle}>{t.phone} <span style={{ color: 'var(--sale)' }}>*</span></label>
      <PhoneInput value={phone} onChange={setPhone} style={inputStyle} />

      <label style={labelStyle}>{t.companyName} <span className="muted" style={{ fontWeight: 400 }}>{t.optional}</span></label>
      <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200}
        placeholder={t.companyHint} style={inputStyle} />

      <label style={labelStyle}>{t.twogisLink} <span className="muted" style={{ fontWeight: 400 }}>{t.optional}</span></label>
      <input value={twogis} onChange={(e) => setTwogis(e.target.value)} maxLength={500} inputMode="url"
        placeholder="2gis.kz/almaty/firm/…" style={inputStyle} />

      {err ? <p style={{ color: 'var(--sale)', fontSize: 14, margin: '12px 0 0' }}>{err}</p> : null}

      <button className="btn btn-primary btn-block" disabled={!canSubmit} onClick={submit}
        style={{ marginTop: 18, height: 50, fontSize: 16, opacity: canSubmit ? 1 : 0.6 }}>
        {busy ? t.sending : t.sendApplication}
      </button>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>{t.consent}</p>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { CLIENT_API } from '../lib/api';

/** Заявка «Стать партнёром». Телефон и имя — обязательны; 2ГИС и компания — нет. */
export default function PartnerForm() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [twogis, setTwogis] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const digits = phone.replace(/\D/g, '');
  const phoneOk = /^(7|8)7\d{9}$/.test(digits);
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
          phone: phone.trim(),
          company: company.trim() || undefined,
          twogisUrl: twogis.trim() || undefined,
          source: 'web',
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : (data.message || 'Не удалось отправить заявку'));
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
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Заявка принята!</div>
        <p className="muted" style={{ margin: 0 }}>
          Мы свяжемся с вами по телефону, чтобы подключить магазин к Kartop. Обычно в течение рабочего дня.
        </p>
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
      <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Станьте партнёром Kartop</div>
      <p className="muted" style={{ margin: '0 0 8px', fontSize: 15 }}>
        Оставьте контакты — поможем вывести ваш магазин с базара в онлайн. Подключение по приглашению.
      </p>

      <label style={labelStyle}>Ваше имя <span style={{ color: 'var(--sale)' }}>*</span></label>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
        placeholder="Как к вам обращаться" style={inputStyle} autoComplete="name" />

      <label style={labelStyle}>Телефон <span style={{ color: 'var(--sale)' }}>*</span></label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={20}
        placeholder="+7 7xx xxx xx xx" style={inputStyle} autoComplete="tel" />

      <label style={labelStyle}>Название компании <span className="muted" style={{ fontWeight: 400 }}>— необязательно</span></label>
      <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200}
        placeholder="Напр. «Фрукты у Руслана»" style={inputStyle} />

      <label style={labelStyle}>Ссылка на 2ГИС <span className="muted" style={{ fontWeight: 400 }}>— необязательно</span></label>
      <input value={twogis} onChange={(e) => setTwogis(e.target.value)} maxLength={500} inputMode="url"
        placeholder="2gis.kz/almaty/firm/…" style={inputStyle} />

      {err ? <p style={{ color: 'var(--sale)', fontSize: 14, margin: '12px 0 0' }}>{err}</p> : null}

      <button className="btn btn-primary btn-block" disabled={!canSubmit} onClick={submit}
        style={{ marginTop: 18, height: 50, fontSize: 16, opacity: canSubmit ? 1 : 0.6 }}>
        {busy ? 'Отправляем…' : 'Отправить заявку'}
      </button>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
        Нажимая кнопку, вы соглашаетесь на обработку контактных данных для связи.
      </p>
    </div>
  );
}

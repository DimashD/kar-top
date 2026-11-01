'use client';

import { useState } from 'react';
import { CLIENT_API } from '../lib/api';

export default function ReviewForm({ orderId }: { orderId: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ rating: number; comment: string | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) return;
    setErr(null); setBusy(true);
    try {
      const r = await fetch(`${CLIENT_API}/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : (data.message || 'Не удалось сохранить'));
      setDone({ rating: data.rating, comment: data.comment ?? null });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card" style={{ padding: 20, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 22, letterSpacing: 2 }}>{'★'.repeat(done.rating)}<span style={{ color: 'var(--line)' }}>{'★'.repeat(5 - done.rating)}</span></div>
        <div style={{ fontWeight: 800, fontSize: 17, margin: '8px 0 2px' }}>Спасибо за оценку!</div>
        <div className="muted" style={{ fontSize: 14 }}>Ваш отзыв помогает магазину и другим покупателям.</div>
      </div>
    );
  }

  const shown = hover || rating;
  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>Оцените заказ</div>
      <div className="muted" style={{ fontSize: 14, marginBottom: 12 }}>Как всё прошло? Свежесть, сборка, доставка.</div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            aria-label={`${n} из 5`}
            style={{ background: 'none', border: 'none', fontSize: 38, lineHeight: 1, cursor: 'pointer', color: n <= shown ? 'var(--carrot)' : 'var(--line)', padding: 0 }}>
            ★
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000}
        placeholder="Комментарий (необязательно)"
        style={{ width: '100%', padding: '12px 14px', fontSize: 15, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--ink)', resize: 'vertical', fontFamily: 'inherit' }} />
      {err ? <p style={{ color: 'var(--sale)', fontSize: 14, margin: '8px 0 0' }}>{err}</p> : null}
      <button className="btn btn-primary btn-block" disabled={rating < 1 || busy} onClick={submit} style={{ marginTop: 12, height: 48, opacity: rating < 1 ? 0.6 : 1 }}>
        {busy ? 'Сохраняем…' : 'Отправить отзыв'}
      </button>
    </div>
  );
}

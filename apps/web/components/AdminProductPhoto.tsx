'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PhotoStatus, photoStatus, uploadSourcePhoto, generateProductPhoto, applyProductPhoto,
  adminImage, photoToJpegBase64, UnauthorizedError,
} from '../lib/admin';

const box: React.CSSProperties = {
  width: '100%', aspectRatio: '1 / 1', borderRadius: 12, border: '1px solid var(--line)', background: '#F4F2F0',
  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', fontSize: 13, color: 'var(--ink-60)', textAlign: 'center',
};
const cap: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: 'var(--ink-60)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 };

/**
 * Фото товара в админке:
 * 1) фото РЕАЛЬНОГО товара (снять на телефон / из галереи) — исходник, покупатели его не видят;
 * 2) «Сгенерировать по шаблону» — Gemini рисует карточку именно этого товара в стиле каталога;
 * 3) проверить → «Сохранить на витрины» или «Ещё вариант».
 */
export default function AdminProductPhoto({ productId, name, onSaved, onUnauthorized }: {
  productId: string; name: string; onSaved?: () => void; onUnauthorized: () => void;
}) {
  const [st, setSt] = useState<PhotoStatus | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<null | 'upload' | 'generate' | 'apply'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const fail = useCallback((e: unknown) => {
    if (e instanceof UnauthorizedError) onUnauthorized(); else setErr((e as Error).message);
  }, [onUnauthorized]);

  const refresh = useCallback(async () => {
    try {
      const s = await photoStatus(productId);
      setSt(s);
      setSource(s.hasSource ? await adminImage(`/admin/catalog/products/${productId}/source-photo`) : null);
      setDraft(s.hasDraft ? await adminImage(`/admin/catalog/products/${productId}/photo-draft`) : null);
    } catch (e) { fail(e); }
  }, [productId, fail]);
  useEffect(() => { refresh(); }, [refresh]);

  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy('upload'); setErr(null); setSaved(false);
    try { await uploadSourcePhoto(productId, await photoToJpegBase64(f)); await refresh(); }
    catch (e) { fail(e); } finally { setBusy(null); if (file.current) file.current.value = ''; }
  }
  async function generate() {
    setBusy('generate'); setErr(null); setSaved(false);
    try { await generateProductPhoto(productId, note.trim()); await refresh(); }
    catch (e) { fail(e); } finally { setBusy(null); }
  }
  async function apply() {
    setBusy('apply'); setErr(null);
    try { await applyProductPhoto(productId); await refresh(); setSaved(true); onSaved?.(); }
    catch (e) { fail(e); } finally { setBusy(null); }
  }

  return (
    <div style={{ padding: 14, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)', marginTop: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div>
          <div style={cap}>1. Реальный товар</div>
          <div style={box}>{source ? <img src={source} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Сфотографируйте товар, который продают на самом деле'}</div>
          <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
          <button className="btn btn-ghost btn-block" disabled={!!busy} onClick={() => file.current?.click()} style={{ marginTop: 8, fontSize: 14 }}>
            {busy === 'upload' ? 'Загружаем…' : source ? 'Заменить фото' : 'Снять / выбрать фото'}
          </button>
        </div>
        <div>
          <div style={cap}>2. По шаблону (Gemini)</div>
          <div style={box}>
            {busy === 'generate' ? 'Генерируем… (до минуты)'
              : draft ? <img src={draft} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} />
              : 'Здесь появится карточка товара в стиле каталога'}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Уточнение (необязательно): «3 штуки», «без упаковки»"
            style={{ width: '100%', marginTop: 8, padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 8, fontFamily: 'inherit' }} />
          <button className="btn btn-primary btn-block" disabled={!!busy || !st?.hasSource || !st?.generatorReady} onClick={generate} style={{ marginTop: 8, fontSize: 14 }}>
            {draft ? 'Ещё вариант' : 'Сгенерировать'}
          </button>
          {st && !st.generatorReady ? <div style={{ fontSize: 12, color: 'var(--sale)', marginTop: 6 }}>На сервере нет ключа GEMINI_API_KEY — генерация выключена.</div> : null}
        </div>
        <div>
          <div style={cap}>3. На витринах сейчас</div>
          <div style={box}>{st?.photoUrl ? <img src={st.photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} /> : 'Фото пока нет'}</div>
          <button className="btn btn-primary btn-block" disabled={!!busy || !draft} onClick={apply} style={{ marginTop: 8, fontSize: 14 }}>
            {busy === 'apply' ? 'Сохраняем…' : 'Сохранить на витрины'}
          </button>
          {saved ? <div style={{ fontSize: 12, color: 'var(--leaf)', marginTop: 6, fontWeight: 700 }}>Сохранено — фото уже на витринах.</div> : null}
        </div>
      </div>
      {err ? <div style={{ color: 'var(--sale)', fontSize: 13, marginTop: 10 }}>{err}</div> : null}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminStore, StoreStatus, listStores, createStore, storeAction, uploadStorePhoto, UnauthorizedError } from '../lib/admin';
import { CLIENT_API } from '../lib/api';
import { useAdmin } from './AdminShell';
import { isValidKzPhone, kzPhoneE164, formatKzPhone } from '../lib/phone';
import PhoneInput from './PhoneInput';
import AdminStoreContract from './AdminStoreContract';

const STATUS_META: Record<StoreStatus, { label: string; color: string; bg: string }> = {
  PENDING:   { label: 'На модерации', color: 'var(--carrot-600)', bg: 'var(--carrot-50)' },
  ACTIVE:    { label: 'Активен',      color: '#fff',              bg: 'var(--leaf)' },
  SUSPENDED: { label: 'Приостановлен',color: 'var(--ink-60)',     bg: 'var(--line)' },
  BLOCKED:   { label: 'Заблокирован', color: '#fff',              bg: 'var(--sale)' },
};
const FILTERS = [
  { key: 'ALL', label: 'Все' },
  { key: 'PENDING', label: 'На модерации' },
  { key: 'ACTIVE', label: 'Активные' },
  { key: 'SUSPENDED', label: 'Приостановл.' },
  { key: 'BLOCKED', label: 'Заблок.' },
];

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
  catch { return iso; }
}

export default function AdminStores() {
  const { signOut } = useAdmin();
  const [filter, setFilter] = useState('ALL');
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // форма создания
  const [name, setName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('+7');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [adding, setAdding] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const load = useCallback(async (f: string) => {
    setLoading(true); setErr(null);
    try { setStores(await listStores(f)); }
    catch (e) { if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message); }
    finally { setLoading(false); }
  }, [signOut]);

  useEffect(() => { load(filter); }, [filter, load]);

  const canAdd = name.trim().length >= 2 && isValidKzPhone(ownerPhone) && !adding;

  async function add() {
    if (!canAdd) return;
    setFormErr(null); setFormOk(null); setAdding(true);
    try {
      await createStore({ name: name.trim(), ownerPhone: kzPhoneE164(ownerPhone), city: city.trim() || undefined, address: address.trim() || undefined });
      setFormOk(`Магазин «${name.trim()}» создан (на модерации). Владелец входит в приложение по этому номеру.`);
      setName(''); setOwnerPhone('+7'); setCity(''); setAddress('');
      await load(filter);
    } catch (e) {
      if (e instanceof UnauthorizedError) signOut(); else setFormErr((e as Error).message);
    } finally { setAdding(false); }
  }

  async function act(id: string, action: 'approve' | 'suspend' | 'block') {
    setSavingId(id); setErr(null);
    try { await storeAction(id, action); await load(filter); }
    catch (e) { if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message); }
    finally { setSavingId(null); }
  }

  async function photo(id: string, file: File) {
    setSavingId(id); setErr(null);
    try {
      const { photoVersion } = await uploadStorePhoto(id, file);
      setStores((xs) => xs.map((x) => (x.id === id ? { ...x, photoVersion } : x)));
    } catch (e) { if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message); }
    finally { setSavingId(null); }
  }

  const input: React.CSSProperties = { width: '100%', padding: '12px 14px', fontSize: 16, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit' };

  return (
    <div className="container" style={{ padding: '24px 20px 56px', maxWidth: 920 }}>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Магазины</h1>
      <p className="muted" style={{ margin: '0 0 20px', fontSize: 15 }}>
        Регистрация магазинов — по приглашению: заводите магазин здесь, владелец входит в приложение по своему номеру.
      </p>

      {/* Форма создания */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 12 }}>Завести магазин</div>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6 }}>Название</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Напр. «Фрукты у Руслана»" style={input} />
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6 }}>Телефон владельца</label>
            <PhoneInput value={ownerPhone} onChange={setOwnerPhone} style={input} />
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6 }}>Город <span className="muted" style={{ fontWeight: 400 }}>— необяз.</span></label>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Алматы / Астана" style={input} />
          </div>
          <div>
            <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 6 }}>Адрес <span className="muted" style={{ fontWeight: 400 }}>— необяз.</span></label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Улица, дом" style={input} />
          </div>
        </div>
        {formErr ? <p style={{ color: 'var(--sale)', fontSize: 14, margin: '10px 0 0' }}>{formErr}</p> : null}
        {formOk ? <p style={{ color: 'var(--leaf)', fontSize: 14, margin: '10px 0 0' }}>{formOk}</p> : null}
        <button className="btn btn-primary" disabled={!canAdd} onClick={add} style={{ marginTop: 14, height: 46, opacity: canAdd ? 1 : 0.6 }}>
          {adding ? 'Создаём…' : 'Завести магазин'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={filter === f.key ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ padding: '8px 14px', fontSize: 14 }}>{f.label}</button>
        ))}
        <button className="btn btn-ghost" onClick={() => load(filter)} style={{ padding: '8px 14px', fontSize: 14, marginLeft: 'auto' }}>↻ Обновить</button>
      </div>

      {err ? <p style={{ color: 'var(--sale)' }}>{err}</p> : null}
      {loading ? <p className="muted">Загрузка…</p> : stores.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}><div className="muted">Магазинов нет.</div></div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {stores.map((s) => {
            const m = STATUS_META[s.status];
            return (
              <div key={s.id} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  {s.photoVersion && s.status === 'ACTIVE' ? (
                    <img src={`${CLIENT_API}/shops/${s.slug}/photo?v=${s.photoVersion}`} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: 'cover' }} />
                  ) : null}
                  <div style={{ minWidth: 200, flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>{s.name}</div>
                    <div className="muted" style={{ fontSize: 13 }}>/{s.slug}</div>
                    {s.owner ? <div style={{ fontSize: 14, marginTop: 2 }}>Владелец: {s.owner.name ? `${s.owner.name}, ` : ''}{formatKzPhone(s.owner.phone)}</div> : null}
                    {s.address ? <div className="muted" style={{ fontSize: 14 }}>{s.address}</div> : null}
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {s.productCount} товаров · {s.orderCount} заказов · с {fmtDate(s.createdAt)}
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: m.color, background: m.bg, whiteSpace: 'nowrap' }}>{m.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {s.status !== 'ACTIVE' ? <button className="btn btn-primary" disabled={savingId === s.id} onClick={() => act(s.id, 'approve')} style={{ padding: '6px 12px', fontSize: 13 }}>Активировать</button> : null}
                  {s.status !== 'SUSPENDED' ? <button className="btn btn-ghost" disabled={savingId === s.id} onClick={() => act(s.id, 'suspend')} style={{ padding: '6px 12px', fontSize: 13 }}>Приостановить</button> : null}
                  {s.status !== 'BLOCKED' ? <button className="btn btn-ghost" disabled={savingId === s.id} onClick={() => act(s.id, 'block')} style={{ padding: '6px 12px', fontSize: 13, color: 'var(--sale)' }}>Заблокировать</button> : null}
                  <label className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
                    {savingId === s.id ? 'Загрузка…' : s.photoVersion ? 'Заменить фото' : 'Загрузить фото'}
                    <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) photo(s.id, f); }} />
                  </label>
                  <a className="btn btn-ghost" href={`/admin/poster/${s.slug}`} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 13, marginLeft: 'auto' }}>🖨️ QR-постер</a>
                  <a className="btn btn-ghost" href={`/${s.slug}`} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 13 }}>Витрина ↗</a>
                </div>
                <AdminStoreContract storeId={s.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CLIENT_API, StoreCard } from '../lib/api';
import { useT } from './LangProvider';

type Point = { lat: number; lng: number };

function distKm(a: Point, b: Point) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/** Открыт ли магазин сейчас (время покупателя — в Казахстане совпадает с магазином). */
function openNow(s: StoreCard): boolean {
  const now = new Date();
  const d = s.hours?.[(now.getDay() + 6) % 7];
  if (!d) return false;
  const m = now.getHours() * 60 + now.getMinutes();
  const toMin = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
  return m >= toMin(d.open) && m < toMin(d.close);
}

/** Список магазинов на главной: поиск по названию/адресу и «Рядом со мной» (сортировка по расстоянию). */
export default function StoreList({ stores }: { stores: StoreCard[] }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [me, setMe] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60_000 },
    );
  }

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = stores
      .filter((s) => words.every((w) => `${s.name} ${s.address ?? ''}`.toLowerCase().includes(w)))
      .map((s) => ({ s, km: me && s.location ? distKm(me, s.location) : null }));
    if (me) list.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
    return list;
  }, [stores, q, me]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.findStore} type="search"
          style={{ flex: '1 1 240px', minWidth: 0, height: 48, padding: '0 16px', fontSize: 16, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--card)', font: 'inherit' }} />
        <button type="button" onClick={locate} className={me ? 'btn btn-primary' : 'btn btn-ghost'} style={{ height: 48, padding: '0 16px' }}>
          📍 {locating ? '…' : t.nearMe}
        </button>
      </div>
      {shown.length === 0 ? <p className="muted">{t.noStores}</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {shown.map(({ s, km }) => {
            const open = openNow(s);
            return (
              <Link key={s.slug} href={`/${s.slug}`} className="card" style={{ overflow: 'hidden', color: 'var(--ink)', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 140, background: 'var(--carrot-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>
                  {s.photoVersion
                    ? <img src={`${CLIENT_API}/shops/${encodeURIComponent(s.slug)}/photo?v=${s.photoVersion}`} alt={s.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : '🧺'}
                </div>
                <div style={{ padding: '12px 14px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 17, flex: 1, minWidth: 0 }}>{s.name}</div>
                    {km != null ? <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`}</span> : null}
                  </div>
                  {s.address ? <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>{s.address}</div> : null}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 13, fontWeight: 700 }}>
                    <span style={{ padding: '3px 8px', borderRadius: 999, background: open ? 'var(--leaf-50)' : 'var(--line)', color: open ? 'var(--leaf)' : 'var(--ink-60)' }}>
                      {open ? t.openNow : t.closedNow}
                    </span>
                    {s.reviewCount ? <span style={{ padding: '3px 8px', borderRadius: 999, background: '#F4F2F0' }}>★ {s.rating.toFixed(1)}</span> : null}
                    {s.deliveryEnabled ? <span style={{ padding: '3px 8px', borderRadius: 999, background: '#F4F2F0' }}>🚚 {t.delivery}</span> : null}
                    {s.pickupEnabled ? <span style={{ padding: '3px 8px', borderRadius: 999, background: '#F4F2F0' }}>🛍️ {t.pickup}</span> : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

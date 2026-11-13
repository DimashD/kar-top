'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CLIENT_API, StoreCard } from '../lib/api';
import { tenge } from '../lib/format';
import { useT } from './LangProvider';
import Icon, { IconName } from './Icon';
import { LogoMark } from './Logo';

type Point = { lat: number; lng: number };
type Kind = 'own' | 'courier' | 'pickup';

function distKm(a: Point, b: Point) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/** Открыт ли магазин сейчас (время покупателя — в Казахстане совпадает с магазином). */
function openNow(s: StoreCard, now: Date): boolean {
  const d = s.hours?.[(now.getDay() + 6) % 7];
  if (!d) return false;
  const m = now.getHours() * 60 + now.getMinutes();
  const toMin = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3));
  return m >= toMin(d.open) && m < toMin(d.close);
}

const own = (s: StoreCard) => s.ownDelivery ?? s.deliveryEnabled;
const courier = (s: StoreCard) => s.courierDelivery ?? false;

/**
 * Список магазинов на главной: поиск, фильтры по способу получения (доставка магазина, курьер, самовывоз)
 * и «Рядом со мной» — сортировка по расстоянию и проверка, довезёт ли магазин сам до покупателя.
 */
export default function StoreList({ stores: initial }: { stores: StoreCard[] }) {
  const t = useT();
  const [stores, setStores] = useState(initial);
  const [q, setQ] = useState('');
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [me, setMe] = useState<Point | null>(null);
  const [locating, setLocating] = useState(false);
  // «Открыто/Закрыто» считаем только в браузере: на сервере другое время (UTC), иначе текст расходится при загрузке.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60_000 },
    );
  }
  // Доступ к местоположению уже дан — сразу показываем ближайших, без лишнего нажатия.
  useEffect(() => {
    navigator.permissions?.query({ name: 'geolocation' as PermissionName })
      .then((p) => { if (p.state === 'granted') locate(); }).catch(() => {});
  }, []);
  // Точка известна — сервер говорит, какие магазины довезут сами и на каких условиях.
  useEffect(() => {
    if (!me) return;
    fetch(`${CLIENT_API}/shops?lat=${me.lat}&lng=${me.lng}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).then((list) => { if (Array.isArray(list)) setStores(list); }).catch(() => {});
  }, [me]);

  const toggle = (k: Kind) => setKinds((v) => (v.includes(k) ? v.filter((x) => x !== k) : [...v, k]));

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = stores
      .filter((s) => words.every((w) => `${s.name} ${s.address ?? ''}`.toLowerCase().includes(w)))
      .filter((s) => kinds.every((k) => (k === 'own' ? own(s) && s.ownHere !== false : k === 'courier' ? courier(s) : s.pickupEnabled)))
      .map((s) => ({ s, km: me && s.location ? distKm(me, s.location) : null }));
    if (me) list.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));
    return list;
  }, [stores, q, me, kinds]);

  const chip = { padding: '3px 8px', borderRadius: 999, background: '#F4F2F0', display: 'inline-flex', alignItems: 'center', gap: 4 } as const;
  const filters: [Kind, IconName, string][] = [['own', 'scooter', t.ownDelivery], ['courier', 'car', t.courierShort], ['pickup', 'bag', t.pickup]];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.findStore} type="search"
          style={{ flex: '1 1 240px', minWidth: 0, height: 48, padding: '0 16px', fontSize: 16, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--card)', font: 'inherit' }} />
        <button type="button" onClick={locate} className={me ? 'btn btn-primary' : 'btn btn-ghost'} style={{ height: 48, padding: '0 16px' }}>
          <Icon name="pin" size={18} />{locating ? '…' : t.nearMe}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {filters.map(([k, ic, label]) => (
          <button key={k} type="button" onClick={() => toggle(k)} className={kinds.includes(k) ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ padding: '8px 12px', fontSize: 14, whiteSpace: 'nowrap', gap: 6 }}><Icon name={ic} size={17} />{label}</button>
        ))}
      </div>
      {!me ? <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>{t.locateToCheck}</p> : null}
      {shown.length === 0 ? <p className="muted">{t.noStores}</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {shown.map(({ s, km }) => {
            const open = now ? openNow(s, now) : null;
            const z = s.ownZone;
            const ownTerms = !z ? '' : z.freeFromTiyn != null && z.feeTiyn ? ` · ${t.freeFromShort(tenge(z.freeFromTiyn))}` : z.feeTiyn ? ` · ${tenge(z.feeTiyn)}` : ` · ${t.freeShort}`;
            return (
              <Link key={s.slug} href={`/${s.slug}`} className="card" style={{ overflow: 'hidden', color: 'var(--ink)', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 140, background: 'var(--carrot-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44 }}>
                  {s.photoVersion
                    ? <img src={`${CLIENT_API}/shops/${encodeURIComponent(s.slug)}/photo?v=${s.photoVersion}`} alt={s.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <LogoMark size={64} />}
                </div>
                <div style={{ padding: '12px 14px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 17, flex: 1, minWidth: 0 }}>{s.name}</div>
                    {km != null ? <span className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{km < 1 ? `${Math.round(km * 1000)} м` : `${km.toFixed(1)} км`}</span> : null}
                  </div>
                  {s.address ? <div className="muted" style={{ fontSize: 14, marginTop: 2 }}>{s.address}</div> : null}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, fontSize: 13, fontWeight: 700 }}>
                    {open != null ? (
                      <span style={{ ...chip, background: open ? 'var(--leaf-50)' : 'var(--line)', color: open ? 'var(--leaf)' : 'var(--ink-60)' }}>
                        {open ? t.openNow : t.closedNow}
                      </span>
                    ) : null}
                    {s.reviewCount ? <span style={chip}>★ {s.rating.toFixed(1)}</span> : null}
                  </div>
                  {/* Способы получения: довезёт ли магазин сам (с условиями зоны), курьер за счёт покупателя, самовывоз. */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 13, fontWeight: 700 }}>
                    {own(s) ? (
                      s.ownHere === true ? <span style={{ ...chip, background: 'var(--leaf-50)', color: 'var(--leaf)' }}><Icon name="scooter" size={15} />{t.ownWillDeliver}{ownTerms}</span>
                        : s.ownHere === false ? <span style={{ ...chip, color: 'var(--ink-60)' }}><Icon name="scooter" size={15} />{t.ownNotHere}</span>
                        : <span style={chip}><Icon name="scooter" size={15} />{t.ownDelivery}</span>
                    ) : null}
                    {courier(s) ? <span style={chip}><Icon name="car" size={15} />{t.courierShort} · {t.atYourCost}</span> : null}
                    {s.pickupEnabled ? <span style={chip}><Icon name="bag" size={15} />{t.pickup}</span> : null}
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

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Point } from './MapPicker';
import Icon from './Icon';

type Suggestion = { label: string; sub: string; point: Point; km: number | null };

// Расстояние по прямой, км.
function distKm(a: Point, b: Point) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

async function photon(q: string, near: Point | null, bbox: boolean, signal: AbortSignal): Promise<Suggestion[]> {
  const params = new URLSearchParams({ q, limit: '10' });
  if (near) {
    // Сильный приоритет близких мест (по умолчанию Photon больше смотрит на «известность» места).
    params.set('lat', String(near.lat)); params.set('lon', String(near.lng));
    params.set('location_bias_scale', '0.1'); params.set('zoom', '14');
    // Сначала только в радиусе ~25 км — город вокруг; если пусто — без ограничения.
    if (bbox) params.set('bbox', [near.lng - 0.3, near.lat - 0.22, near.lng + 0.3, near.lat + 0.22].join(','));
  }
  const r = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  const d = await r.json();
  const seen = new Set<string>();
  return (d.features ?? [])
    .filter((f: any) => !f.properties?.countrycode || f.properties.countrycode === 'KZ')
    .map((f: any) => {
      const p = f.properties ?? {};
      const street = p.street ?? (p.type === 'street' ? p.name : null);
      const label = street ? [street, p.housenumber].filter(Boolean).join(', ') : p.name ?? '';
      const sub = [street && p.name && p.name !== street ? p.name : null, p.district, p.city].filter(Boolean).join(', ');
      const [lng, lat] = f.geometry?.coordinates ?? [];
      const point = { lat, lng };
      return { label, sub, point, km: near && Number.isFinite(lat) ? distKm(near, point) : null };
    })
    .filter((s: Suggestion) => {
      const key = `${s.label}|${s.sub}`;
      if (!s.label || !Number.isFinite(s.point.lat) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a: Suggestion, b: Suggestion) => (a.km ?? 0) - (b.km ?? 0))
    .slice(0, 6);
}

// Подсказки адресов — Photon (OpenStreetMap): ближайшие к покупателю (или к магазину) — первыми.
async function suggest(q: string, near: Point | null, signal: AbortSignal): Promise<Suggestion[]> {
  const local = await photon(q, near, true, signal);
  return local.length || !near ? local : photon(q, near, false, signal);
}

// Где покупатель: только если доступ к геопозиции уже дан или он разрешит при вводе адреса.
function myPosition(): Promise<Point | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60_000 },
    );
  });
}

const fmtKm = (km: number) => (km < 1 ? `${Math.max(50, Math.round(km * 1000 / 50) * 50)} м` : `${km < 10 ? km.toFixed(1) : Math.round(km)} км`);

/**
 * Поле адреса с подсказками: начинаете вводить — ниже список улиц и домов рядом с магазином.
 * Выбор подсказки заполняет адрес и сразу ставит точку на карте (onPick).
 */
export default function AddressInput({ value, onChange, onPick, near, placeholder, style }: {
  value: string; onChange: (v: string) => void; onPick: (address: string, point: Point) => void;
  near: Point | null; placeholder: string; style: React.CSSProperties;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const typed = useRef(false);
  // Своя геопозиция покупателя важнее точки магазина: подсказываем адреса рядом с ним.
  const [me, setMe] = useState<Point | null>(null);
  const asked = useRef(false);
  const center = me ?? near;
  function locate() {
    if (asked.current) return;
    asked.current = true;
    myPosition().then((p) => p && setMe(p));
  }

  useEffect(() => {
    if (!typed.current || value.trim().length < 3) { setItems([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      suggest(value.trim(), center, ctrl.signal).then((s) => { setItems(s); setOpen(true); }).catch(() => {});
    }, 350);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [value, center]);

  return (
    <div style={{ position: 'relative' }}>
      <input value={value} placeholder={placeholder} style={style} autoComplete="street-address"
        onChange={(e) => { typed.current = true; onChange(e.target.value); }}
        onFocus={() => { locate(); if (items.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && items.length ? (
        <div role="listbox" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 5, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          {items.map((s, i) => (
            <button key={i} type="button" role="option" aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { typed.current = false; setOpen(false); setItems([]); onPick(s.label, s.point); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', borderTop: i ? '1px solid var(--line)' : 'none', background: 'transparent', font: 'inherit', cursor: 'pointer', color: 'var(--ink)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <div style={{ fontWeight: 700, fontSize: 15, flex: 1 }}><Icon name="pin" size={16} style={{ marginRight: 6, color: 'var(--carrot)' }} />{s.label}</div>
                {s.km != null ? <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtKm(s.km)}</span> : null}
              </div>
              {s.sub ? <div className="muted" style={{ fontSize: 12 }}>{s.sub}</div> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

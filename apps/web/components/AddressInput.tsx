'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { bestMatch, suggest, type Point, type Suggestion } from '../lib/geocode';

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
 * Если адрес дописали руками и подсказку не выбрали — точка ставится по лучшему совпадению (onLocate),
 * а если адрес не нашёлся — точка снимается (onLocate(null)), чтобы не осталась старая.
 */
export default function AddressInput({ value, onChange, onPick, onLocate, near, placeholder, style }: {
  value: string; onChange: (v: string) => void; onPick: (address: string, point: Point) => void;
  onLocate?: (point: Point | null) => void;
  near: Point | null; placeholder: string; style: React.CSSProperties;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  // Последний текст, набранный руками. Если value поменяли снаружи (адрес с карты) — подсказки и поиск точки не запускаем.
  const typed = useRef<string | null>(null);
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
    if (typed.current !== value || value.trim().length < 3) { setItems([]); return; }
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      suggest(value.trim(), center, ctrl.signal).then((s) => {
        setItems(s); setOpen(true);
        // Адрес набирают руками — сразу отмечаем его на карте (лучшее совпадение по тексту).
        onLocate?.(bestMatch(s, value)?.point ?? null);
      }).catch(() => {});
    }, 500);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [value, center]);

  return (
    <div style={{ position: 'relative' }}>
      <input value={value} placeholder={placeholder} style={style} autoComplete="street-address"
        onChange={(e) => { typed.current = e.target.value; onChange(e.target.value); }}
        onFocus={() => { locate(); if (items.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && items.length ? (
        <div role="listbox" style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 5, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          {items.map((s, i) => (
            <button key={i} type="button" role="option" aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { typed.current = null; setOpen(false); setItems([]); onPick(s.label, s.point); }}
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

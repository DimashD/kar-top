'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Catalog, CatalogProduct, CLIENT_API } from '../lib/api';
import { tenge, perUnit, isWeighted, qtyLabel } from '../lib/format';
import { categoryStyle } from '../lib/category';
import { isValidKzPhone, kzPhoneE164 } from '../lib/phone';
import { localized } from '../lib/i18n';
import PhoneInput from './PhoneInput';
import { LangSwitcher, useLang, useT } from './LangProvider';

type Line = { product: CatalogProduct; qty: number }; // qty: граммы (весовой) или штуки

function defaultStep(p: CatalogProduct): number {
  return isWeighted(p.unit) ? (p.stepG && p.stepG > 0 ? p.stepG : 500) : 1;
}
function lineTiyn(l: Line): number {
  return isWeighted(l.product.unit)
    ? Math.round((l.product.priceTiyn * l.qty) / 1000)
    : l.product.priceTiyn * l.qty;
}

export default function StoreView({ catalog, slug }: { catalog: Catalog; slug: string }) {
  const t = useT();
  const lang = useLang();
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ id: string; number: number; estimatedTiyn: number; deliveryCode?: string } | null>(null);

  const lines = Object.values(cart);
  const subtotal = lines.reduce((s, l) => s + lineTiyn(l), 0);
  const count = lines.length;

  function add(p: CatalogProduct) {
    setCart((c) => {
      const cur = c[p.id];
      const step = defaultStep(p);
      return { ...c, [p.id]: { product: p, qty: (cur?.qty ?? 0) + step } };
    });
  }
  function dec(p: CatalogProduct) {
    setCart((c) => {
      const cur = c[p.id];
      if (!cur) return c;
      const step = defaultStep(p);
      const qty = cur.qty - step;
      const next = { ...c };
      if (qty <= 0) delete next[p.id];
      else next[p.id] = { ...cur, qty };
      return next;
    });
  }

  return (
    <main style={{ paddingBottom: count ? 88 : 24 }}>
      <Header slug={slug} name={catalog.store.name} rating={catalog.store.rating} reviewCount={catalog.store.reviewCount} address={catalog.store.address} />

      <div className="container" style={{ paddingTop: 20 }}>
        {catalog.categories.map((cat, i) => (
          <section key={i} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 20, marginBottom: 14 }}>{localized(cat.category, lang)}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
              {cat.items.map((p) => (
                <ProductCard key={p.id} p={p} catRu={cat.category.ru} cat={localized(cat.category, lang)} qty={cart[p.id]?.qty ?? 0} onAdd={() => add(p)} onDec={() => dec(p)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {count > 0 && !open && (
        <button className="btn btn-primary" onClick={() => setOpen(true)}
          style={{ position: 'fixed', left: 16, right: 16, bottom: 16, maxWidth: 'calc(var(--maxw) - 40px)', margin: '0 auto', height: 56, boxShadow: 'var(--shadow)', fontSize: 16 }}>
          <span>{t.cartButton(count)}</span>
          <span style={{ marginLeft: 'auto' }}>{tenge(subtotal)}</span>
        </button>
      )}

      {open && (
        <CheckoutDrawer
          slug={slug}
          store={catalog.store}
          lines={lines}
          subtotal={subtotal}
          onClose={() => setOpen(false)}
          onInc={add}
          onDec={dec}
          onDone={(r) => { setDone(r); setCart({}); setOpen(false); }}
        />
      )}

      {done && <OrderPlaced order={done} onClose={() => setDone(null)} />}
    </main>
  );
}

function Header({ slug, name, rating, reviewCount, address }: { slug: string; name: string; rating: number; reviewCount?: number; address: string | null }) {
  const t = useT();
  return (
    <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 5 }}>
      <div className="container" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <Link href={`/${slug}`} style={{ fontWeight: 900, fontSize: 20, color: 'var(--carrot)' }}>Kartop</Link>
        <div style={{ height: 24, width: 1, background: 'var(--line)' }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            ★ {rating.toFixed(1)}{reviewCount ? ` · ${t.reviewsShort(reviewCount)}` : ''}{address ? ` · ${address}` : ''}
          </div>
        </div>
        <LangSwitcher />
      </div>
    </header>
  );
}

function ProductCard({ p, cat, catRu, qty, onAdd, onDec }: { p: CatalogProduct; cat: string; catRu: string; qty: number; onAdd: () => void; onDec: () => void }) {
  const t = useT();
  const lang = useLang();
  const name = localized(p.name, lang);
  const sale = p.oldPriceTiyn && p.oldPriceTiyn > p.priceTiyn;
  // Оформление подбирается по русскому названию категории.
  const cs = categoryStyle(catRu);
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="photo-ph" style={{ position: 'relative', padding: 0, background: p.photo ? undefined : `linear-gradient(135deg, ${cs.from}, ${cs.to})` }}>
        {p.photo ? (
          <img src={p.photo} alt={name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 44, lineHeight: 1 }}>{cs.emoji}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: cs.ink, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{cat}</span>
          </div>
        )}
        {sale ? <span className="badge badge-sale" style={{ position: 'absolute', top: 8, left: 8 }}>{t.sale}</span> : null}
        {p.perishable ? <span className="badge badge-leaf" style={{ position: 'absolute', top: 8, right: 8 }}>{t.fresh}</span> : null}
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{name}</div>
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="price">{tenge(p.priceTiyn)}</span>
            {sale ? <span className="price-old">{tenge(p.oldPriceTiyn!)}</span> : null}
          </div>
          <div className="unit">{perUnit(p.unit, t)}</div>
        </div>
        {qty === 0 ? (
          <button className="btn btn-ghost btn-block" onClick={onAdd}>{t.addToCart}</button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onDec} style={{ padding: '8px 14px' }}>−</button>
            <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
              {qtyLabel(p.unit, qty, t)}
            </span>
            <button className="btn btn-ghost" onClick={onAdd} style={{ padding: '8px 14px' }}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutDrawer(props: {
  slug: string; store: Catalog['store']; lines: Line[]; subtotal: number;
  onClose: () => void; onInc: (p: CatalogProduct) => void; onDec: (p: CatalogProduct) => void;
  onDone: (r: { id: string; number: number; estimatedTiyn: number; deliveryCode?: string }) => void;
}) {
  const { slug, store, lines, subtotal, onClose, onInc, onDec, onDone } = props;
  const t = useT();
  const lang = useLang();
  const [mode, setMode] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [phone, setPhone] = useState('+7');
  const [line, setLine] = useState('');
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [pickupAt, setPickupAt] = useState('');
  const [pay, setPay] = useState<'CASH' | 'CARD_COURIER' | 'KASPI_TRANSFER'>('CASH');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Самое раннее время самовывоза = сейчас + лид-тайм магазина (для <input type=datetime-local>, локальное).
  const earliest = useMemo(() => {
    const d = new Date(Date.now() + (store.pickupLeadMinutes ?? 60) * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [store.pickupLeadMinutes]);

  function locate() {
    if (!navigator.geolocation) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoBusy(false); },
      () => setGeoBusy(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const phoneOk = isValidKzPhone(phone);
  const addrOk = mode === 'PICKUP' || line.trim().length >= 5;
  const pickupOk = mode === 'DELIVERY' || !pickupAt || pickupAt >= earliest;
  const canSubmit = lines.length > 0 && phoneOk && addrOk && pickupOk && !busy;

  async function submit() {
    setErr(null); setBusy(true);
    try {
      const items = lines.map((l) => isWeighted(l.product.unit)
        ? { storeProductId: l.product.id, qtyG: l.qty }
        : { storeProductId: l.product.id, qty: l.qty });
      const body: any = { storeSlug: slug, phone: kzPhoneE164(phone), payMethod: pay, fulfillment: mode, items };
      if (mode === 'DELIVERY') body.address = { line: line.trim(), ...(geo ? { lat: geo.lat, lng: geo.lng } : {}) };
      else if (pickupAt) body.pickupAt = new Date(pickupAt).toISOString();
      const r = await fetch(`${CLIENT_API}/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : (data.message || t.checkoutError));
      onDone({ id: data.id, number: data.number, estimatedTiyn: data.estimatedTiyn ?? data.subtotalTiyn ?? subtotal, deliveryCode: data.deliveryCode });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,18,0.4)', zIndex: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg)', width: '100%', maxWidth: 'var(--maxw)', borderRadius: '20px 20px 0 0', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg)' }}>
          <h2 style={{ fontSize: 20 }}>{t.cart}</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '8px 12px' }}>{t.close}</button>
        </div>

        <div style={{ padding: '0 20px' }}>
          {lines.map((l) => (
            <div key={l.product.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{localized(l.product.name, lang)}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {qtyLabel(l.product.unit, l.qty, t)} · {tenge(lineTiyn(l))}
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => onDec(l.product)} style={{ padding: '6px 12px' }}>−</button>
              <button className="btn btn-ghost" onClick={() => onInc(l.product)} style={{ padding: '6px 12px' }}>+</button>
            </div>
          ))}
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Способ получения */}
          <Field label={t.fulfillment}>
            <div style={{ display: 'grid', gridTemplateColumns: store.pickupEnabled ? '1fr 1fr' : '1fr', gap: 8 }}>
              <ModeBtn active={mode === 'DELIVERY'} onClick={() => setMode('DELIVERY')} icon="🚗" title={t.delivery} />
              {store.pickupEnabled ? <ModeBtn active={mode === 'PICKUP'} onClick={() => setMode('PICKUP')} icon="🛍️" title={t.pickup} /> : null}
            </div>
          </Field>

          <Field label={t.contactPhone}>
            <PhoneInput value={phone} onChange={(v) => setPhone(v)} style={inputStyle(!phone || phone === '+7' || phoneOk)} />
          </Field>

          {mode === 'DELIVERY' ? (
            <Field label={t.deliveryAddress}>
              <input value={line} onChange={(e) => setLine(e.target.value)} placeholder={t.addressPlaceholder} style={inputStyle(true)} />
              <button type="button" onClick={locate} className="btn btn-ghost" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
                {geoBusy ? t.locating : geo ? t.locationAdded : t.addLocation}
              </button>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {t.locationHint}
              </div>
            </Field>
          ) : (
            <Field label={t.pickupTime(store.pickupLeadMinutes)}>
              <input type="datetime-local" value={pickupAt} min={earliest} onChange={(e) => setPickupAt(e.target.value)} style={inputStyle(pickupOk)} />
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                {store.address ? t.pickupFrom(store.address) : t.pickupAddressLater}
              </div>
            </Field>
          )}

          <Field label={t.payOnReceipt}>
            <div style={{ display: 'grid', gap: 8 }}>
              {([['CASH', t.payCash], ['CARD_COURIER', t.payCard], ['KASPI_TRANSFER', t.payKaspi]] as const).map(([v, label]) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: `1px solid ${pay === v ? 'var(--carrot)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)', background: pay === v ? 'var(--carrot-50)' : 'var(--card)', cursor: 'pointer' }}>
                  <input type="radio" name="pay" checked={pay === v} onChange={() => setPay(v)} />
                  <span style={{ fontWeight: 600 }}>{label}</span>
                </label>
              ))}
            </div>
          </Field>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, marginTop: 4 }}>
            <span className="muted">{t.estimate}</span>
            <span className="price">{tenge(subtotal)}</span>
          </div>
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            {t.estimateNote}
          </p>
          {err ? <p style={{ color: 'var(--sale)', fontSize: 14, margin: 0 }}>{err}</p> : null}
          <button className="btn btn-primary btn-block" disabled={!canSubmit} onClick={submit} style={{ height: 52, fontSize: 16 }}>
            {busy ? t.placing : t.placeOrder}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderPlaced({ order, onClose }: { order: { id: string; number: number; estimatedTiyn: number; deliveryCode?: string }; onClose: () => void }) {
  const t = useT();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,18,0.4)', zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: 28, textAlign: 'center', boxShadow: 'var(--shadow)' }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <h2 style={{ fontSize: 24, margin: '12px 0 6px' }}>{t.orderPlaced(order.number)}</h2>
        <p className="muted" style={{ marginTop: 0 }}>{t.orderPlacedText(tenge(order.estimatedTiyn))}</p>
        {order.deliveryCode ? (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 'var(--radius-sm)', background: 'var(--carrot-50)', border: '1px solid var(--carrot)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--carrot-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t.pickupCode}</div>
            <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: '0.2em', margin: '4px 0' }}>{order.deliveryCode}</div>
            <div className="muted" style={{ fontSize: 13 }}>{t.sayCode}</div>
          </div>
        ) : null}
        <a className="btn btn-primary btn-block" href={`/order/${order.id}`} style={{ marginTop: 16 }}>{t.trackOrder}</a>
        <button className="btn btn-ghost btn-block" onClick={onClose} style={{ marginTop: 8 }}>{t.continueShopping}</button>
      </div>
    </div>
  );
}

function ModeBtn({ active, onClick, icon, title }: { active: boolean; onClick: () => void; icon: string; title: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 10px',
      border: `1px solid ${active ? 'var(--carrot)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)',
      background: active ? 'var(--carrot-50)' : 'var(--card)', color: active ? 'var(--carrot-600)' : 'var(--ink)',
      fontWeight: 700, fontSize: 15,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>{title}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-60)', marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}
function inputStyle(ok: boolean): React.CSSProperties {
  return { width: '100%', padding: '12px 14px', fontSize: 15, border: `1px solid ${ok ? 'var(--line)' : 'var(--sale)'}`, borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--ink)', outline: 'none' };
}

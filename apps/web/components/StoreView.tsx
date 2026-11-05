'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Catalog, CatalogProduct, CLIENT_API } from '../lib/api';
import { tenge, perUnit, isWeighted, qtyLabel, grams } from '../lib/format';
import { isValidKzPhone, kzPhoneE164 } from '../lib/phone';
import { Lang, localized } from '../lib/i18n';
import { findProducts, ListMatch, parseList, qtyFor } from '../lib/smart-list';
import { initialsFor, pictureFor, tintFor } from '../lib/pictures';
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

// Прошлый заказ в этом магазине хранится на устройстве покупателя — для «Повторить заказ».
type LastOrder = { at: string; totalTiyn: number; lines: { id: string; qty: number }[] };
const lastKey = (slug: string) => `kartop:last-order:${slug}`;
function readLast(slug: string): LastOrder | null {
  try {
    const raw = localStorage.getItem(lastKey(slug));
    return raw ? (JSON.parse(raw) as LastOrder) : null;
  } catch {
    return null;
  }
}
function saveLast(slug: string, lines: Line[], totalTiyn: number) {
  try {
    const v: LastOrder = { at: new Date().toISOString(), totalTiyn, lines: lines.map((l) => ({ id: l.product.id, qty: l.qty })) };
    localStorage.setItem(lastKey(slug), JSON.stringify(v));
  } catch { /* приватный режим — просто без «Повторить» */ }
}

type Look = { pic: string | null; tint: string; initials: string };

type Section = { id: string; title: string; groups: { title: string; items: CatalogProduct[] }[] };

/** Разделы витрины: крупные группы каталога, внутри — подкатегории. */
function sections(catalog: Catalog, lang: Lang): Section[] {
  const out: Section[] = [];
  for (const c of catalog.categories) {
    const id = c.group?.id ?? 'other';
    const title = c.group ? localized(c.group.name, lang) : localized(c.category, lang);
    let s = out.find((x) => x.id === id);
    if (!s) { s = { id, title, groups: [] }; out.push(s); }
    s.groups.push({ title: localized(c.category, lang), items: c.items });
  }
  return out;
}

export default function StoreView({ catalog, slug }: { catalog: Catalog; slug: string }) {
  const t = useT();
  const lang = useLang();
  const [cart, setCart] = useState<Record<string, Line>>({});
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<{ id: string; number: number; estimatedTiyn: number; deliveryCode?: string } | null>(null);
  const [mode, setMode] = useState<'catalog' | 'list'>('catalog');
  const [query, setQuery] = useState('');
  const [weighing, setWeighing] = useState<CatalogProduct | null>(null);
  const [last, setLast] = useState<LastOrder | null>(null);
  useEffect(() => { setLast(readLast(slug)); }, [slug]);

  const all = useMemo(() => catalog.categories.flatMap((c) => c.items), [catalog]);
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  // Пиктограмма и фон каждого товара — по его названию, подкатегории и группе (русские названия каталога).
  const looks = useMemo(() => {
    const m = new Map<string, Look>();
    for (const c of catalog.categories) {
      for (const p of c.items) {
        m.set(p.id, { pic: pictureFor(p.name.ru, c.category.ru), tint: tintFor(c.group?.name.ru ?? c.category.ru), initials: initialsFor(localized(p.name, lang)) });
      }
    }
    return m;
  }, [catalog, lang]);
  const secs = useMemo(() => sections(catalog, lang), [catalog, lang]);
  const found = useMemo(() => (query.trim() ? findProducts(query, all) : null), [query, all]);

  const lines = Object.values(cart);
  const subtotal = lines.reduce((s, l) => s + lineTiyn(l), 0);
  const count = lines.length;

  function setQty(p: CatalogProduct, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[p.id];
      else next[p.id] = { product: p, qty };
      return next;
    });
  }
  // Весовой товар — через шторку выбора веса; штучный — сразу +1.
  function add(p: CatalogProduct) {
    if (isWeighted(p.unit)) setWeighing(p);
    else setQty(p, (cart[p.id]?.qty ?? 0) + 1);
  }
  function inc(p: CatalogProduct) { setQty(p, (cart[p.id]?.qty ?? 0) + defaultStep(p)); }
  function dec(p: CatalogProduct) { setQty(p, (cart[p.id]?.qty ?? 0) - defaultStep(p)); }
  function addMany(items: { product: CatalogProduct; qty: number }[]) {
    setCart((c) => {
      const next = { ...c };
      for (const it of items) next[it.product.id] = { product: it.product, qty: (next[it.product.id]?.qty ?? 0) + it.qty };
      return next;
    });
  }

  // «Повторить заказ»: только товары, которые сейчас есть в витрине.
  const repeatable = (last?.lines ?? []).map((l) => ({ product: byId.get(l.id), qty: l.qty })).filter((l): l is Line => !!l.product);

  return (
    <main style={{ paddingBottom: count ? 88 : 24 }}>
      <Header name={catalog.store.name} rating={catalog.store.rating} reviewCount={catalog.store.reviewCount} address={catalog.store.address} slug={slug} />

      <div className="container" style={{ paddingTop: 14, maxWidth: 760 }}>
        {/* Каталог / Списком */}
        <div role="tablist" style={{ display: 'flex', background: '#F4F2F0', borderRadius: 12, padding: 4, marginBottom: 12 }}>
          {(['catalog', 'list'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
              style={{ flex: 1, height: 40, border: 'none', borderRadius: 9, font: 'inherit', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                background: mode === m ? 'var(--card)' : 'transparent', color: mode === m ? 'var(--ink)' : 'var(--ink-60)',
                boxShadow: mode === m ? '0 1px 2px rgba(26,21,18,0.1)' : 'none' }}>
              {m === 'catalog' ? t.tabCatalog : t.tabList}
            </button>
          ))}
        </div>

        {repeatable.length && last ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, background: 'var(--ink)', color: '#fff', marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{t.repeatTitle}</div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>
                {t.repeatMeta(repeatable.length, tenge(last.totalTiyn), new Date(last.at).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'kk' ? 'kk-KZ' : 'ru-RU', { day: 'numeric', month: 'long' }))}
              </div>
            </div>
            <button className="btn" onClick={() => { addMany(repeatable); setOpen(true); }}
              style={{ background: '#fff', color: 'var(--ink)', fontWeight: 800, height: 40, padding: '0 14px' }}>{t.repeatAdd}</button>
          </div>
        ) : null}

        {mode === 'list' ? (
          <QuickList products={all} onAdd={(items) => { addMany(items); setMode('catalog'); setOpen(true); }} />
        ) : (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 14px', background: '#F4F2F0', borderRadius: 12, marginBottom: 10 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-60)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchInShop} aria-label={t.searchInShop}
                style={{ flex: 1, border: 'none', background: 'transparent', font: 'inherit', fontSize: 16, outline: 'none', color: 'var(--ink)' }} />
            </label>

            {found ? (
              <section>
                {found.length ? found.slice(0, 30).map((p) => (
                  <ProductRow key={p.id} p={p} look={looks.get(p.id)} qty={cart[p.id]?.qty ?? 0} onAdd={() => add(p)} onInc={() => inc(p)} onDec={() => dec(p)} onEdit={() => setWeighing(p)} />
                )) : <p className="muted" style={{ padding: '24px 0', textAlign: 'center' }}>{t.nothingFound}</p>}
              </section>
            ) : (
              <>
                {/* Быстрые кнопки разделов — прилипают к верху и прокручивают к разделу */}
                <nav style={{ position: 'sticky', top: 66, zIndex: 4, background: 'var(--bg)', display: 'flex', gap: 8, overflowX: 'auto', padding: '6px 0 10px', scrollbarWidth: 'none' }}>
                  {secs.map((s) => (
                    <a key={s.id} href={`#sec-${s.id}`} style={{ flexShrink: 0, height: 36, display: 'flex', alignItems: 'center', padding: '0 14px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 700, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </a>
                  ))}
                </nav>
                {secs.map((s) => (
                  <section key={s.id} id={`sec-${s.id}`} style={{ scrollMarginTop: 120, marginBottom: 18 }}>
                    <h2 style={{ fontSize: 20, margin: '8px 0 2px' }}>{s.title}</h2>
                    {s.groups.map((g, gi) => (
                      <div key={gi}>
                        {s.groups.length > 1 || g.title !== s.title ? <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-40)', padding: '12px 0 2px' }}>{g.title}</div> : null}
                        {g.items.map((p) => (
                          <ProductRow key={p.id} p={p} look={looks.get(p.id)} qty={cart[p.id]?.qty ?? 0} onAdd={() => add(p)} onInc={() => inc(p)} onDec={() => dec(p)} onEdit={() => setWeighing(p)} />
                        ))}
                      </div>
                    ))}
                  </section>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {count > 0 && !open && (
        <button className="btn btn-primary" onClick={() => setOpen(true)}
          style={{ position: 'fixed', left: 16, right: 16, bottom: 16, maxWidth: 'calc(var(--maxw) - 40px)', margin: '0 auto', height: 56, boxShadow: 'var(--shadow)', fontSize: 16 }}>
          <span>{t.cartButton(count)}</span>
          <span style={{ marginLeft: 'auto' }}>{tenge(subtotal)}</span>
        </button>
      )}

      {weighing ? (
        <WeightSheet p={weighing} initial={cart[weighing.id]?.qty ?? 0}
          onClose={() => setWeighing(null)}
          onSave={(g) => { setQty(weighing, g); setWeighing(null); }} />
      ) : null}

      {open && (
        <CheckoutDrawer
          slug={slug}
          store={catalog.store}
          lines={lines}
          subtotal={subtotal}
          onClose={() => setOpen(false)}
          onInc={inc}
          onDec={dec}
          onDone={(r) => { saveLast(slug, lines, r.estimatedTiyn); setLast(readLast(slug)); setDone(r); setCart({}); setOpen(false); }}
        />
      )}

      {done && <OrderPlaced order={done} onClose={() => setDone(null)} />}
    </main>
  );
}

function Header({ name, rating, reviewCount, address, slug }: { name: string; rating: number; reviewCount?: number; address: string | null; slug: string }) {
  const t = useT();
  return (
    <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 5 }}>
      <div className="container" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 760 }}>
        <Link href={`/${slug}`} style={{ minWidth: 0, flex: 1, color: 'var(--ink)', textDecoration: 'none' }}>
          <div style={{ fontWeight: 800, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ★ {rating.toFixed(1)}{reviewCount ? ` · ${t.reviewsShort(reviewCount)}` : ''}{address ? ` · ${address}` : ''}
          </div>
        </Link>
        <LangSwitcher />
      </div>
    </header>
  );
}

/** Строка товара (вариант «список»): фото, название, цена; справа «+» или счётчик. */
function ProductRow({ p, look, qty, onAdd, onInc, onDec, onEdit }: { p: CatalogProduct; look?: Look; qty: number; onAdd: () => void; onInc: () => void; onDec: () => void; onEdit: () => void }) {
  const t = useT();
  const lang = useLang();
  const name = localized(p.name, lang);
  const sale = p.oldPriceTiyn && p.oldPriceTiyn > p.priceTiyn;
  const weighted = isWeighted(p.unit);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F1ECE8' }}>
      {/* Фото магазина; пока его нет — пиктограмма самого товара (или инициалы) на фоне цвета группы. */}
      <div style={{ width: 64, height: 64, borderRadius: 16, background: look?.tint ?? '#F4F2F0', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.photo ? <img src={p.photo} alt={name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : look?.pic ? <span aria-hidden="true" style={{ fontSize: 36, lineHeight: 1 }}>{look.pic}</span>
          : <span aria-hidden="true" style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink-60)' }}>{look?.initials}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{tenge(p.priceTiyn)}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-40)' }}>{perUnit(p.unit, t)}</span>
          {sale ? <span className="price-old" style={{ fontSize: 12 }}>{tenge(p.oldPriceTiyn!)}</span> : null}
        </div>
      </div>
      {qty === 0 ? (
        <button aria-label={t.addToCart} onClick={onAdd}
          style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: '#F4F2F0', fontSize: 24, color: 'var(--ink)', cursor: 'pointer' }}>+</button>
      ) : weighted ? (
        <button onClick={onEdit}
          style={{ height: 44, padding: '0 12px', borderRadius: 12, border: 'none', background: 'var(--carrot)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          {qtyLabel(p.unit, qty, t)}
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', background: '#F4F2F0', borderRadius: 12, height: 44 }}>
          <button aria-label={t.remove} onClick={onDec} style={{ width: 38, height: 44, border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>−</button>
          <span style={{ minWidth: 40, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>{qtyLabel(p.unit, qty, t)}</span>
          <button aria-label={t.add} onClick={onInc} style={{ width: 38, height: 44, border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer' }}>+</button>
        </div>
      )}
    </div>
  );
}

/** Шторка выбора веса: быстрые 0,5 / 1 / 1,5 / 2 кг, подстройка по 100 г, честная подсказка про взвешивание. */
function WeightSheet({ p, initial, onClose, onSave }: { p: CatalogProduct; initial: number; onClose: () => void; onSave: (g: number) => void }) {
  const t = useT();
  const lang = useLang();
  const [g, setG] = useState(initial > 0 ? initial : 1000);
  const presets = [500, 1000, 1500, 2000];
  const pieces = p.avgPieceG ? Math.max(1, Math.round(g / p.avgPieceG)) : null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,18,0.45)', zIndex: 25, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-label={localized(p.name, lang)} onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--card)', width: '100%', maxWidth: 520, borderRadius: '22px 22px 0 0', padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{localized(p.name, lang)}</div>
          <div className="muted" style={{ fontSize: 15 }}>{tenge(p.priceTiyn)} {perUnit(p.unit, t)}</div>
        </div>
        <div style={{ fontWeight: 800 }}>{t.howMuch}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {presets.map((v) => (
            <button key={v} onClick={() => setG(v)}
              style={{ height: 50, borderRadius: 12, font: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer',
                border: g === v ? '2px solid var(--carrot)' : '1px solid var(--line)', background: g === v ? 'var(--carrot-50)' : 'var(--card)', color: 'var(--ink)' }}>
              {grams(v, t)}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F4F2F0', borderRadius: 14, padding: 6 }}>
          <button aria-label={t.remove} onClick={() => setG((x) => Math.max(100, x - 100))} style={{ width: 48, height: 48, border: 'none', borderRadius: 10, background: 'var(--card)', fontSize: 22, cursor: 'pointer' }}>−</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{grams(g, t)}</div>
            <div className="muted" style={{ fontSize: 12 }}>{t.step100}{pieces ? ` · ${t.aboutPieces(String(pieces))}` : ''}</div>
          </div>
          <button aria-label={t.add} onClick={() => setG((x) => x + 100)} style={{ width: 48, height: 48, border: 'none', borderRadius: 10, background: 'var(--card)', fontSize: 22, cursor: 'pointer' }}>+</button>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink-60)', background: '#FCF4E6', borderRadius: 12, padding: '10px 12px' }}>{t.weightNote}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {initial > 0 ? (
            <button className="btn btn-ghost" onClick={() => onSave(0)} style={{ height: 52 }}>{t.remove}</button>
          ) : null}
          <button className="btn btn-primary" onClick={() => onSave(g)} style={{ flex: 1, height: 52, fontSize: 16 }}>
            <span>{t.add}</span><span style={{ marginLeft: 'auto' }}>≈ {tenge(Math.round((p.priceTiyn * g) / 1000))}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Распознавание речи браузера (Chrome/Android, Safari/iOS). Нет — кнопка микрофона не показывается.
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
function makeRecognition(): Recognition | null {
  if (typeof window === 'undefined') return null;
  const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return C ? (new C() as Recognition) : null;
}
const SPEECH_LANG: Record<Lang, string> = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-US' };

/** «Списком»: текст как в заметках или голос → подобранные товары с количеством → в корзину. */
function QuickList({ products, onAdd }: { products: CatalogProduct[]; onAdd: (items: { product: CatalogProduct; qty: number }[]) => void }) {
  const t = useT();
  const lang = useLang();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const rec = useRef<Recognition | null>(null);
  // Выбор покупателя по каждой строке: индекс варианта и количество; «снята галочка» — не добавлять.
  const [picked, setPicked] = useState<Record<number, { option: number; qty: number; off?: boolean }>>({});
  useEffect(() => { setCanSpeak(!!makeRecognition()); }, []);

  const matches: ListMatch[] = useMemo(() => parseList(text, products), [text, products]);
  useEffect(() => { setPicked({}); }, [text]);

  function toggleVoice() {
    if (listening) { rec.current?.stop(); return; }
    const r = makeRecognition();
    if (!r) return;
    r.lang = SPEECH_LANG[lang];
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e: any) => {
      const said = Array.from(e.results as ArrayLike<any>).slice(e.resultIndex).map((res: any) => res[0].transcript).join(' ').trim();
      if (said) setText((prev) => (prev.trim() ? `${prev.trim()}\n${said}` : said));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  const chosen = matches.map((m, i) => {
    const sel = picked[i];
    const product = m.options[sel?.option ?? 0];
    return { m, i, product, qty: sel?.qty ?? m.qty, off: !!sel?.off };
  });
  const toAdd = chosen.filter((c) => c.product && !c.off) as { product: CatalogProduct; qty: number; m: ListMatch; i: number; off: boolean }[];
  const sum = toAdd.reduce((s, c) => s + lineTiyn({ product: c.product, qty: c.qty }), 0);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label htmlFor="smart-list" style={{ fontWeight: 800, fontSize: 15 }}>{t.listLabel}</label>
      <textarea id="smart-list" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t.listPlaceholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1.5px solid var(--carrot)', borderRadius: 14, font: 'inherit', fontSize: 16, lineHeight: 1.5, resize: 'vertical', color: 'var(--ink)', background: 'var(--card)' }} />
      {canSpeak ? (
        <button onClick={toggleVoice} className="btn"
          style={{ height: 48, justifyContent: 'center', gap: 10, fontWeight: 800, background: listening ? 'var(--carrot)' : 'var(--card)', color: listening ? '#fff' : 'var(--ink)', border: '1px solid var(--line)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
          {listening ? t.stopListening : t.speak}
        </button>
      ) : null}
      {listening ? <div className="muted" style={{ fontSize: 13 }}>{t.listening}</div> : <div className="muted" style={{ fontSize: 13 }}>{t.listHint}</div>}

      <div>
        {chosen.map(({ m, i, product, qty, off }) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #F1ECE8', opacity: off ? 0.45 : 1 }}>
            {product ? (
              <button aria-pressed={!off} onClick={() => setPicked((s) => ({ ...s, [i]: { option: s[i]?.option ?? 0, qty: s[i]?.qty ?? m.qty, off: !off } }))}
                style={{ width: 24, height: 24, marginTop: 2, borderRadius: 999, border: off ? '2px solid var(--line)' : 'none', background: off ? 'transparent' : 'var(--leaf)', color: '#fff', flexShrink: 0, cursor: 'pointer', fontSize: 14 }}>
                {off ? '' : '✓'}
              </button>
            ) : <span style={{ width: 24, height: 24, marginTop: 2, borderRadius: 999, border: '2px solid #D48A00', flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-40)' }}>«{m.typed}»</div>
              {product ? (
                <>
                  <div style={{ fontWeight: 700 }}>{localized(product.name, lang)}</div>
                  {m.options.length > 1 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                      {m.ambiguous ? <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-60)' }}>{t.whichOne}</span> : null}
                      {m.options.map((o, oi) => (
                        <button key={o.id} onClick={() => setPicked((s) => ({ ...s, [i]: { option: oi, qty: qtyFor(o, m, m.options[s[i]?.option ?? 0]), off: false } }))}
                          style={{ height: 30, padding: '0 10px', borderRadius: 999, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            border: o.id === product.id ? '1.5px solid var(--carrot)' : '1px solid var(--line)', background: o.id === product.id ? 'var(--carrot-50)' : 'var(--card)', color: 'var(--ink)' }}>
                          {localized(o.name, lang)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : <div style={{ fontWeight: 700, color: '#A86A00' }}>{t.notFound(m.typed)}</div>}
            </div>
            {product ? (
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button aria-label={t.remove} onClick={() => setPicked((s) => ({ ...s, [i]: { option: s[i]?.option ?? 0, qty: Math.max(defaultStep(product), qty - defaultStep(product)) } }))}
                    style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: '#F4F2F0', cursor: 'pointer' }}>−</button>
                  <span style={{ minWidth: 54, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>{qtyLabel(product.unit, qty, t)}</span>
                  <button aria-label={t.add} onClick={() => setPicked((s) => ({ ...s, [i]: { option: s[i]?.option ?? 0, qty: qty + defaultStep(product) } }))}
                    style={{ width: 30, height: 30, border: 'none', borderRadius: 8, background: '#F4F2F0', cursor: 'pointer' }}>+</button>
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{tenge(lineTiyn({ product, qty }))}</div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {toAdd.length ? (
        <button className="btn btn-primary btn-block" onClick={() => onAdd(toAdd.map((c) => ({ product: c.product, qty: c.qty })))} style={{ height: 52, fontSize: 16 }}>
          <span>{t.addItems(toAdd.length)}</span><span style={{ marginLeft: 'auto' }}>≈ {tenge(sum)}</span>
        </button>
      ) : null}
    </section>
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
  // Своя доставка может быть выключена магазином — тогда только самовывоз.
  const deliveryOn = store.deliveryEnabled !== false;
  const [mode, setMode] = useState<'DELIVERY' | 'PICKUP'>(deliveryOn ? 'DELIVERY' : 'PICKUP');
  const [phone, setPhone] = useState('+7');
  const [line, setLine] = useState('');
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [pickupAt, setPickupAt] = useState('');
  const [payChoice, setPay] = useState<'CASH' | 'CARD_COURIER' | 'KASPI_TRANSFER'>('CASH');
  // Курьерская служба денег не берёт — при её доставке только перевод Kaspi (то же правило на сервере).
  const serviceDelivery = mode === 'DELIVERY' && store.deliveryMode === 'SERVICE';
  const pay = serviceDelivery ? 'KASPI_TRANSFER' : payChoice;
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
            <div style={{ display: 'grid', gridTemplateColumns: store.pickupEnabled && deliveryOn ? '1fr 1fr' : '1fr', gap: 8 }}>
              {deliveryOn ? <ModeBtn active={mode === 'DELIVERY'} onClick={() => setMode('DELIVERY')} icon="🚗" title={t.delivery} /> : null}
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

          <Field label={t.payment}>
            <div style={{ display: 'grid', gap: 8 }}>
              {([['CASH', t.payCash], ['CARD_COURIER', t.payCard], ['KASPI_TRANSFER', t.payKaspi]] as const)
                .filter(([v]) => !serviceDelivery || v === 'KASPI_TRANSFER').map(([v, label]) => (
                <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: `1px solid ${pay === v ? 'var(--carrot)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)', background: pay === v ? 'var(--carrot-50)' : 'var(--card)', cursor: 'pointer' }}>
                  <input type="radio" name="pay" checked={pay === v} onChange={() => setPay(v)} />
                  <span style={{ fontWeight: 600 }}>{label}</span>
                </label>
              ))}
            </div>
            {serviceDelivery || pay === 'KASPI_TRANSFER' ? (
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>{serviceDelivery ? t.serviceDeliveryNote : t.kaspiNote}</div>
            ) : null}
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

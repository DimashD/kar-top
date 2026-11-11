'use client';

import FeedbackButton from './FeedbackButton';
import StoreMenu from './StoreMenu';
import BottomNav, { BOTTOM_NAV_H } from './BottomNav';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Catalog, CatalogProduct, CLIENT_API } from '../lib/api';
import { tenge, perUnit, isWeighted, qtyLabel, grams } from '../lib/format';
import { formatKzPhone, isValidKzPhone, kzPhoneE164 } from '../lib/phone';
import { Lang, LOCALES, localized } from '../lib/i18n';
import { findProducts, ListMatch, parseList, qtyFor, SearchProduct } from '../lib/smart-list';
import { initialsFor, pictureFor, tintFor } from '../lib/pictures';
import PhoneInput from './PhoneInput';
import { useLang, useT } from './LangProvider';
import { ANDROID_URL, inKartopApp } from '../lib/app-links';
import MapPicker from './MapPicker';
import AddressInput from './AddressInput';

type Line = { product: CatalogProduct; qty: number }; // qty: граммы (весовой) или штуки

// Шаг «−/+»: весовые — 100 г (как в шторке веса и корзине), штучные — 1.
/** Весовой товар — не больше 20 кг в одной позиции (так же проверяет сервер). */
export const MAX_WEIGHT_G = 20000;
function capQty(p: CatalogProduct, qty: number): number {
  return isWeighted(p.unit) ? Math.min(qty, MAX_WEIGHT_G) : qty;
}
function defaultStep(p: CatalogProduct): number {
  return isWeighted(p.unit) ? 100 : 1;
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

// Вход покупателя по SMS: access-токен (15 мин) + refresh (30 дней, с ротацией).
// Код спрашиваем только при первом заказе с устройства; дальше продлеваем вход без SMS.
export type Session = { access: string; refresh: string; phone: string; accessExp: number };
const SESSION_KEY = 'kartop:session';
export function readSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null;
  } catch {
    return null;
  }
}
function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY);
  } catch { /* приватный режим — подтвердим номер ещё раз */ }
}
function sessionFrom(data: { accessToken: string; refreshToken: string }, phone: string): Session {
  return { access: data.accessToken, refresh: data.refreshToken, phone, accessExp: Date.now() + 14 * 60_000 };
}
/**
 * Пуши в приложении покупателя: приложение кладёт FCM-токен в window.kartopPushToken
 * (и шлёт событие kartop-push-token), а мы регистрируем его на вошедшего покупателя — один раз на пару токен+номер.
 */
async function registerAppPush() {
  const push = (window as any).kartopPushToken as string | undefined;
  const s = readSession();
  if (!push || !s) return;
  const mark = `${push}|${s.phone}|customer`;
  try { if (localStorage.getItem('kartop:push') === mark) return; } catch { /* ок */ }
  const token = await accessToken();
  if (!token) return;
  const r = await fetch(`${CLIENT_API}/devices/push-token`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ platform: 'android', token: push, app: 'customer' }),
  }).catch(() => null);
  if (r?.ok) try { localStorage.setItem('kartop:push', mark); } catch { /* ок */ }
}
/** Выход на этом устройстве: телефон перестаёт получать пуши этого покупателя, сессия удаляется. */
export async function logout() {
  const push = (window as any).kartopPushToken as string | undefined;
  const token = readSession() ? await accessToken() : null;
  if (push && token) {
    await fetch(`${CLIENT_API}/devices/push-token/remove`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ token: push }),
    }).catch(() => {});
  }
  saveSession(null);
  try { localStorage.removeItem('kartop:push'); } catch { /* ок */ }
}
/** Действующий access-токен: из памяти или продлённый по refresh. null — нужно подтвердить номер. */
export async function accessToken(force = false): Promise<string | null> {
  const s = readSession();
  if (!s) return null;
  if (!force && s.accessExp > Date.now()) return s.access;
  try {
    const r = await fetch(`${CLIENT_API}/auth/otp/refresh`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refresh }),
    });
    if (!r.ok) throw new Error();
    const next = sessionFrom(await r.json(), s.phone);
    saveSession(next);
    return next.access;
  } catch {
    saveSession(null);
    return null;
  }
}

/**
 * Подтверждение номера — шторка после «Оформить заказ»: номер → код из SMS (6 цифр, автоподстановка,
 * отправка сама при последней цифре, повтор через 60 с). После кода заказ оформляется сразу.
 */
export function AuthSheet({ initialPhone, onClose, onDone, hint, confirmLabel }: { initialPhone: string; onClose: () => void; onDone: (s: Session) => void; hint?: string; confirmLabel?: string }) {
  const t = useT();
  const [phone, setPhone] = useState(initialPhone);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  // Куда просили и куда ушёл код: Telegram без аккаунта на номере — сервер шлёт SMS.
  const [via, setVia] = useState<'telegram' | 'sms'>('telegram');
  const [sentVia, setSentVia] = useState<string | null>(null);
  // Вход через Telegram-бот: ссылка на бота, ждём, пока покупатель поделится номером.
  const [tg, setTg] = useState<{ token: string; botUrl: string } | null>(null);
  const openBot = (url: string) => { if (inKartopApp()) location.href = url; else window.open(url, '_blank'); };
  async function loginTelegram() {
    setErr(null);
    const r = await fetch(`${CLIENT_API}/auth/telegram/start`, { method: 'POST' }).catch(() => null);
    const d = r?.ok ? await r.json() : null;
    if (!d?.botUrl) { setErr(t.checkoutError); return; }
    setTg(d);
    openBot(d.botUrl);
  }
  useEffect(() => {
    if (!tg) return;
    const id = setInterval(async () => {
      const r = await fetch(`${CLIENT_API}/auth/telegram/poll`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tg.token }),
      }).catch(() => null);
      const d = r?.ok ? await r.json() : null;
      if (d?.status === 'ok' && d.accessToken) {
        clearInterval(id);
        const s = sessionFrom(d, d.phone);
        saveSession(s);
        registerAppPush();
        onDone(s);
      } else if (d?.status === 'expired') {
        clearInterval(id);
        setTg(null);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [tg]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!wait) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function send(channel: 'telegram' | 'sms' = via) {
    setErr(null); setBusy(true); setVia(channel);
    try {
      const r = await fetch(`${CLIENT_API}/auth/otp/request`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: kzPhoneE164(phone), channel }),
      });
      if (!r.ok) throw new Error();
      setSentVia((await r.json().catch(() => ({}))).channel ?? null);
      setStep('code'); setCode(''); setWait(60);
    } catch {
      setErr(t.checkoutError);
    } finally {
      setBusy(false);
    }
  }

  async function verify(c: string) {
    setErr(null); setBusy(true);
    try {
      const r = await fetch(`${CLIENT_API}/auth/otp/verify`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: kzPhoneE164(phone), code: c, deviceLabel: 'web' }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.accessToken) throw new Error();
      const s = sessionFrom(data, kzPhoneE164(phone));
      saveSession(s);
      registerAppPush();
      onDone(s);
    } catch {
      setErr(t.wrongCode); setCode('');
    } finally {
      setBusy(false);
    }
  }

  const big: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 56, padding: '0 16px', fontSize: 20, fontWeight: 800, border: '1.5px solid var(--line)', borderRadius: 14, background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit' };
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,18,0.45)', zIndex: 10000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-label={t.confirmPhoneTitle} onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--card)', width: '100%', maxWidth: 520, borderRadius: '22px 22px 0 0', padding: '22px 20px 26px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 21, fontWeight: 800 }}>{step === 'phone' ? t.confirmPhoneTitle : t.enterCode}</div>
        {tg ? (
          <>
            <div style={{ fontSize: 15 }}>{t.tgWaiting}</div>
            <div className="muted" style={{ textAlign: 'center', fontSize: 28 }}>⏳</div>
            <button className="btn btn-primary btn-block" onClick={() => openBot(tg.botUrl)} style={{ height: 52, background: '#229ED9', borderColor: '#229ED9' }}>✈️ {t.tgOpenAgain}</button>
            <button className="btn btn-ghost btn-block" onClick={() => setTg(null)} style={{ height: 46 }}>{t.orByCode}</button>
          </>
        ) : step === 'phone' ? (
          <>
            <div className="muted" style={{ fontSize: 15 }}>{hint ?? t.confirmPhoneHint}</div>
            {/* Быстрее всего — через бот Kartop в Telegram: номер подтверждает Telegram, код не нужен. */}
            <button className="btn btn-primary btn-block" disabled={busy} onClick={loginTelegram} style={{ height: 54, fontSize: 16, background: '#229ED9', borderColor: '#229ED9' }}>
              ✈️ {t.loginTelegram}
            </button>
            <div className="muted" style={{ textAlign: 'center', fontSize: 13 }}>{t.orByCode}</div>
            <PhoneInput value={phone} onChange={setPhone} style={big} />
            {/* Telegram — бесплатно для покупателя и дешевле для нас; SMS — для всех. */}
            <button className="btn btn-ghost btn-block" disabled={!isValidKzPhone(phone) || busy} onClick={() => send('sms')} style={{ height: 50, fontSize: 16 }}>
              {busy ? t.sendingCode : `💬 ${t.codeSms}`}
            </button>
          </>
        ) : (
          <>
            <div className="muted" style={{ fontSize: 15 }}>
              {sentVia === 'telegram' ? t.sentTelegram(formatKzPhone(phone)) : sentVia === 'sms' ? t.sentSms(formatKzPhone(phone)) : t.codeSent(formatKzPhone(phone))} · <button type="button" onClick={() => { setStep('phone'); setErr(null); }} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--carrot-600)', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>{t.changePhone}</button>
            </div>
            {via === 'telegram' && sentVia === 'sms' ? <div style={{ fontSize: 14, color: 'var(--ink-60)', background: '#FCF4E6', borderRadius: 10, padding: '8px 10px' }}>{t.telegramFallback}</div> : null}
            <input value={code} autoFocus inputMode="numeric" autoComplete="one-time-code" aria-label={t.smsCode} placeholder="••••••"
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(v);
                if (v.length === 6 && !busy) verify(v);
              }}
              style={{ ...big, textAlign: 'center', letterSpacing: '0.4em', fontSize: 26 }} />
            <button className="btn btn-primary btn-block" disabled={code.length < 6 || busy} onClick={() => verify(code)} style={{ height: 54, fontSize: 16 }}>
              {busy ? t.checkingCode : confirmLabel ?? t.confirmAndOrder}
            </button>
            <button className="btn btn-ghost btn-block" disabled={wait > 0 || busy} onClick={() => send()} style={{ height: 46 }}>
              {wait > 0 ? t.resendIn(wait) : t.resendCode}
            </button>
          </>
        )}
        {err ? <div style={{ color: 'var(--sale)', fontSize: 14 }}>{err}</div> : null}
      </div>
    </div>
  );
}

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
  // В приложении: регистрируем токен пушей, как только он есть и покупатель вошёл.
  useEffect(() => {
    registerAppPush();
    window.addEventListener('kartop-push-token', registerAppPush);
    return () => window.removeEventListener('kartop-push-token', registerAppPush);
  }, []);

  // Товары с подкатегорией: поиск «яблоки» находит сорта «Фуджи», «Апорт».
  const all: SearchProduct[] = useMemo(() => catalog.categories.flatMap((c) => c.items.map((p) => ({ ...p, category: c.category }))), [catalog]);
  // Корзина переживает переходы и перезагрузку (храним id → количество; товары берём из свежего каталога).
  const cartKey = `kartop:cart:${slug}`;
  const restored = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(cartKey) ?? '{}') as Record<string, number>;
      const byId = new Map(all.map((p) => [p.id, p]));
      const next: Record<string, Line> = {};
      for (const [id, qty] of Object.entries(saved)) { const p = byId.get(id); if (p && qty > 0) next[id] = { product: p, qty }; }
      if (Object.keys(next).length) setCart(next);
    } catch { /* нет хранилища — корзина только на время страницы */ }
    restored.current = true;
  }, [cartKey, all]);
  useEffect(() => {
    if (!restored.current) return;
    try { localStorage.setItem(cartKey, JSON.stringify(Object.fromEntries(Object.entries(cart).map(([id, l]) => [id, l.qty])))); } catch { /* ок */ }
  }, [cart, cartKey]);
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
      else next[p.id] = { product: p, qty: capQty(p, qty) };
      return next;
    });
  }
  // Весовой товар — через шторку выбора веса; штучный — сразу +1.
  function add(p: CatalogProduct) {
    setQty(p, (cart[p.id]?.qty ?? 0) + (isWeighted(p.unit) ? p.stepG || 500 : 1));
  }
  function inc(p: CatalogProduct) { setQty(p, (cart[p.id]?.qty ?? 0) + defaultStep(p)); }
  function dec(p: CatalogProduct) { setQty(p, (cart[p.id]?.qty ?? 0) - defaultStep(p)); }
  function addMany(items: { product: CatalogProduct; qty: number }[]) {
    setCart((c) => {
      const next = { ...c };
      for (const it of items) next[it.product.id] = { product: it.product, qty: capQty(it.product, (next[it.product.id]?.qty ?? 0) + it.qty) };
      return next;
    });
  }

  // «Повторить заказ»: только товары, которые сейчас есть в витрине.
  const repeatable = (last?.lines ?? []).map((l) => ({ product: byId.get(l.id), qty: l.qty })).filter((l): l is Line => !!l.product);

  return (
    <main style={{ paddingBottom: count ? 88 : 24 }}>
      <StorePhoto slug={slug} version={catalog.store.photoVersion} name={catalog.store.name} />
      <Header name={catalog.store.name} rating={catalog.store.rating} reviewCount={catalog.store.reviewCount} address={catalog.store.address} slug={slug} photo={shopPhotoUrl(slug, catalog.store.photoVersion)} />

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
                  <ProductRow key={p.id} p={p} look={looks.get(p.id)} showCategory qty={cart[p.id]?.qty ?? 0} onAdd={() => add(p)} onInc={() => inc(p)} onDec={() => dec(p)} onSet={(q) => setQty(p, q)} onEdit={() => setWeighing(p)} />
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
                          <ProductRow key={p.id} p={p} look={looks.get(p.id)} qty={cart[p.id]?.qty ?? 0} onAdd={() => add(p)} onInc={() => inc(p)} onDec={() => dec(p)} onSet={(q) => setQty(p, q)} onEdit={() => setWeighing(p)} />
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
          style={{ position: 'fixed', left: 16, right: 16, bottom: `calc(${BOTTOM_NAV_H + 12}px + env(safe-area-inset-bottom))`, zIndex: 21, maxWidth: 'calc(var(--maxw) - 40px)', margin: '0 auto', height: 56, boxShadow: 'var(--shadow)', fontSize: 16 }}>
          <span>{t.cartButton(count)}</span>
          <span style={{ marginLeft: 'auto' }}>{tenge(subtotal)}</span>
        </button>
      )}

      {weighing ? (
        <WeightSheet p={weighing} look={looks.get(weighing.id)} initial={cart[weighing.id]?.qty ?? 0}
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
          looks={looks}
          onSet={setQty}
          onEdit={(p) => setWeighing(p)}
          onDone={(r) => { saveLast(slug, lines, r.estimatedTiyn); setLast(readLast(slug)); setDone(r); setCart({}); setOpen(false); }}
        />
      )}

      {done && <OrderPlaced order={done} onClose={() => setDone(null)} />}
      <FeedbackButton storeSlug={slug} />
      <div style={{ height: count > 0 ? 72 : 0 }} />
      <BottomNav />
    </main>
  );
}

const shopPhotoUrl = (slug: string, v?: number | null) => (v ? `${CLIENT_API}/shops/${encodeURIComponent(slug)}/photo?v=${v}` : null);

/** Фото магазина над витриной — покупатель видит, у кого покупает. Нажатие — во весь экран. */
function StorePhoto({ slug, version, name }: { slug: string; version?: number | null; name: string }) {
  const [big, setBig] = useState(false);
  const src = shopPhotoUrl(slug, version);
  if (!src) return null;
  return (
    <>
      <button type="button" onClick={() => setBig(true)} aria-label={name}
        style={{ display: 'block', width: '100%', padding: 0, border: 'none', background: 'var(--line)', cursor: 'zoom-in' }}>
        <img src={src} alt={name} style={{ display: 'block', width: '100%', maxWidth: 760, height: 180, objectFit: 'cover', margin: '0 auto' }} />
      </button>
      {big ? (
        <div role="dialog" onClick={() => setBig(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, cursor: 'zoom-out' }}>
          <img src={src} alt={name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />
        </div>
      ) : null}
    </>
  );
}

function Header({ name, rating, reviewCount, address, slug, photo }: { name: string; rating: number; reviewCount?: number; address: string | null; slug: string; photo?: string | null }) {
  const t = useT();
  return (
    <header style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 5 }}>
      <div className="container" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 760 }}>
        <StoreMenu />
        {photo ? <img src={photo} alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', flex: 'none' }} /> : null}
        <Link href={`/${slug}/about`} style={{ minWidth: 0, flex: 1, color: 'var(--ink)', textDecoration: 'none' }}>
          <div style={{ fontWeight: 800, fontSize: 17, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
          <div className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ★ {rating.toFixed(1)}{reviewCount ? ` · ${t.reviewsShort(reviewCount)}` : ''}{address ? ` · ${address}` : ''}
          </div>
        </Link>
      </div>
    </header>
  );
}

/** Строка товара (вариант «список»): фото, название, цена; справа «+» или счётчик. */
function ProductRow({ p, look, showCategory, qty, onAdd, onInc, onDec, onSet, onEdit }: { p: SearchProduct; look?: Look; showCategory?: boolean; qty: number; onAdd: () => void; onInc: () => void; onDec: () => void; onSet: (qty: number) => void; onEdit: () => void }) {
  const t = useT();
  const lang = useLang();
  const name = localized(p.name, lang);
  const sale = p.oldPriceTiyn && p.oldPriceTiyn > p.priceTiyn;
  const weighted = isWeighted(p.unit);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #F1ECE8' }}>
      {/* Нажатие на товар — карточка: большое фото, вес или количество. */}
      <button type="button" onClick={onEdit} aria-label={name}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: 0, border: 'none', background: 'transparent', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
      {/* Фото магазина; пока его нет — пиктограмма самого товара (или инициалы) на фоне цвета группы. */}
      <div style={{ width: 88, height: 88, borderRadius: 18, background: p.photo ? '#fff' : look?.tint ?? '#F4F2F0', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.photo ? <img src={p.photo} alt={name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : look?.pic ? <span aria-hidden="true" style={{ fontSize: 44, lineHeight: 1 }}>{look.pic}</span>
          : <span aria-hidden="true" style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink-60)' }}>{look?.initials}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {showCategory && p.category ? <div style={{ fontSize: 12, color: 'var(--ink-40)' }}>{localized(p.category, lang)}</div> : null}
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>{tenge(p.priceTiyn)}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-40)' }}>{perUnit(p.unit, t)}</span>
          {sale ? <span className="price-old" style={{ fontSize: 12 }}>{tenge(p.oldPriceTiyn!)}</span> : null}
        </div>
      </div>
      </button>
      {qty === 0 ? (
        <button aria-label={t.addToCart} onClick={onAdd}
          style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: '#F4F2F0', fontSize: 24, color: 'var(--ink)', cursor: 'pointer' }}>+</button>
      ) : (
        // Уже в корзине: тот же счётчик, что в корзине — «− 1 кг +»; у весовых нажатие на вес открывает шторку.
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--carrot-50)', border: '1px solid var(--carrot)', borderRadius: 12, height: 44 }}>
          <button aria-label={t.remove} onClick={onDec} style={{ width: 38, height: 42, border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--carrot-600)' }}>−</button>
          <QtyInput unit={p.unit} qty={qty} onSet={onSet} />
          <button aria-label={t.add} onClick={onInc} style={{ width: 38, height: 42, border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--carrot-600)' }}>+</button>
        </div>
      )}
    </div>
  );
}

/**
 * Количество числом прямо в строке каталога: весовые — в кг (1,5), штучные — целым числом. 0 — убрать из корзины.
 * Применяется по Enter или когда поле теряет фокус.
 */
function QtyInput({ unit, qty, onSet }: { unit: CatalogProduct['unit']; qty: number; onSet: (qty: number) => void }) {
  const t = useT();
  const weighted = isWeighted(unit);
  const shown = weighted ? String(Math.round(qty / 100) / 10).replace('.', ',') : String(qty);
  const [v, setV] = useState(shown);
  useEffect(() => setV(shown), [shown]);
  const suffix = qtyLabel(unit, weighted ? 1000 : 1, t).replace(/^[\d\s.,]+/, '');
  function commit() {
    const n = Number(v.replace(',', '.').replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n) || v.trim() === '') { setV(shown); return; }
    const next = weighted ? Math.min(MAX_WEIGHT_G, Math.round(n * 10) * 100) : Math.round(n);
    if (next !== qty) onSet(Math.max(0, next)); else setV(shown);
  }
  return (
    <label style={{ display: 'flex', alignItems: 'baseline', gap: 2, padding: '0 2px' }}>
      <input value={v} inputMode={weighted ? 'decimal' : 'numeric'} aria-label={t.howMuch}
        onChange={(e) => setV(e.target.value)} onBlur={commit} onFocus={(e) => e.target.select()}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={{ width: weighted ? 40 : 32, border: 'none', background: 'transparent', textAlign: 'right', font: 'inherit', fontWeight: 800, fontSize: 16, color: 'var(--ink)', padding: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-60)' }}>{suffix}</span>
    </label>
  );
}

/**
 * Карточка товара: большое фото и выбор количества. Весовой — лента 0,5 · 1 · 1,5 · 2… кг (шаг полкило),
 * точная подстройка «−/+» по 100 г, подсказка про взвешивание; штучный — «−/+» по одной.
 */
function WeightSheet({ p, look, initial, onClose, onSave }: { p: CatalogProduct; look?: Look; initial: number; onClose: () => void; onSave: (g: number) => void }) {
  const t = useT();
  const lang = useLang();
  const weighted = isWeighted(p.unit);
  const [g, setG] = useState(initial > 0 ? initial : weighted ? 1000 : 1);
  // Лента 0,5 … 20 кг (больше одного товара в позиции не берём).
  const maxPreset = MAX_WEIGHT_G;
  const presets = Array.from({ length: maxPreset / 500 }, (_, i) => (i + 1) * 500);
  const strip = useRef<HTMLDivElement>(null);
  // Выбранный (или ближайший) вес — по центру ленты.
  useEffect(() => {
    const near = Math.max(500, Math.round(g / 500) * 500);
    if (!weighted) return;
    strip.current?.querySelector<HTMLElement>(`[data-g="${near}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [g]);
  const pieces = p.avgPieceG ? Math.max(1, Math.round(g / p.avgPieceG)) : null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,18,0.45)', zIndex: 25, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-label={localized(p.name, lang)} onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--card)', width: '100%', maxWidth: 520, maxHeight: '94vh', overflowY: 'auto', borderRadius: '22px 22px 0 0', padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: p.photo ? '#fff' : look?.tint ?? '#F4F2F0', borderRadius: 18, height: p.photo ? 'min(320px, 38vh)' : 140, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 'none' }}>
          {p.photo ? <img src={p.photo} alt={localized(p.name, lang)} style={{ height: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            : look?.pic ? <span aria-hidden="true" style={{ fontSize: 72, lineHeight: 1 }}>{look.pic}</span>
            : <span aria-hidden="true" style={{ fontSize: 40, fontWeight: 900, color: 'var(--ink-60)' }}>{look?.initials}</span>}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{localized(p.name, lang)}</div>
          <div className="muted" style={{ fontSize: 15 }}>{tenge(p.priceTiyn)} {perUnit(p.unit, t)}</div>
        </div>
        {weighted ? (<>
        <div style={{ fontWeight: 800 }}>{t.howMuch}</div>
        <div ref={strip} style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x proximity', scrollbarWidth: 'none', margin: '0 -20px', padding: '2px 20px' }}>
          {presets.map((v) => (
            <button key={v} data-g={v} onClick={() => setG(v)}
              style={{ flex: '0 0 auto', minWidth: 76, height: 50, borderRadius: 12, font: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer', scrollSnapAlign: 'center',
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
          <button aria-label={t.add} disabled={g >= MAX_WEIGHT_G} onClick={() => setG((x) => Math.min(MAX_WEIGHT_G, x + 100))} style={{ width: 48, height: 48, border: 'none', borderRadius: 10, background: 'var(--card)', fontSize: 22, cursor: 'pointer' }}>+</button>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--ink-60)', background: '#FCF4E6', borderRadius: 12, padding: '10px 12px' }}>{t.weightNote}</div>
        </>) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F4F2F0', borderRadius: 14, padding: 6 }}>
            <button aria-label={t.remove} onClick={() => setG((x) => Math.max(1, x - 1))} style={{ width: 48, height: 48, border: 'none', borderRadius: 10, background: 'var(--card)', fontSize: 22, cursor: 'pointer' }}>−</button>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{qtyLabel(p.unit, g, t)}</div>
            <button aria-label={t.add} onClick={() => setG((x) => x + 1)} style={{ width: 48, height: 48, border: 'none', borderRadius: 10, background: 'var(--card)', fontSize: 22, cursor: 'pointer' }}>+</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {initial > 0 ? (
            <button className="btn btn-ghost" onClick={() => onSave(0)} style={{ height: 52 }}>{t.remove}</button>
          ) : null}
          <button className="btn btn-primary" onClick={() => onSave(g)} style={{ flex: 1, height: 52, fontSize: 16 }}>
            <span>{t.add}</span><span style={{ marginLeft: 'auto' }}>{weighted ? `≈ ${tenge(Math.round((p.priceTiyn * g) / 1000))}` : tenge(p.priceTiyn * g)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** «Списком»: текст как в заметках или голос → подобранные товары с количеством → в корзину. */
function QuickList({ products, onAdd }: { products: SearchProduct[]; onAdd: (items: { product: CatalogProduct; qty: number }[]) => void }) {
  const t = useT();
  const lang = useLang();
  const [text, setText] = useState('');
  // Голосовой ввод — только в приложении Kartop; на сайте кнопка предлагает его скачать.
  const [askApp, setAskApp] = useState(false);
  // В приложении голос распознаёт телефон и возвращает текст сюда — он дописывается в список.
  useEffect(() => {
    (window as any).kartopVoiceResult = (said: string) => setText((prev) => (prev.trim() ? `${prev.trim()}\n${said}` : said));
    return () => { delete (window as any).kartopVoiceResult; };
  }, []);
  function speak() {
    if (inKartopApp()) (window as any).KartopApp.postMessage(`voice:${lang}`);
    else setAskApp(true);
  }
  // Выбор покупателя по каждой строке: индекс варианта и количество; «снята галочка» — не добавлять.
  const [picked, setPicked] = useState<Record<number, { option: number; qty: number; off?: boolean }>>({});

  const matches: ListMatch[] = useMemo(() => parseList(text, products), [text, products]);
  useEffect(() => { setPicked({}); }, [text]);

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
      <button onClick={speak} className="btn"
        style={{ height: 48, justifyContent: 'center', gap: 10, fontWeight: 800, background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--line)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        {t.speak}
      </button>
      <div className="muted" style={{ fontSize: 13 }}>{t.listHint}</div>
      {askApp ? (
        <div onClick={() => setAskApp(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,18,0.45)', zIndex: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div role="dialog" aria-label={t.voiceInApp} onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card)', width: '100%', maxWidth: 520, borderRadius: '22px 22px 0 0', padding: '22px 20px 24px', display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{t.voiceInApp}</div>
            <div className="muted" style={{ fontSize: 15 }}>{t.voiceInAppText}</div>
            <a className="btn btn-primary btn-block" href={ANDROID_URL} style={{ height: 52, fontSize: 16, justifyContent: 'center' }}>{t.downloadApp}</a>
            <button className="btn btn-ghost btn-block" onClick={() => setAskApp(false)} style={{ height: 48 }}>{t.continueInBrowser}</button>
          </div>
        </div>
      ) : null}

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
                  <div style={{ fontWeight: 700 }}>{product.category ? <span style={{ color: 'var(--ink-40)', fontWeight: 600 }}>{localized(product.category, lang)} · </span> : null}{localized(product.name, lang)}</div>
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

/**
 * Строка корзины: картинка, название и цена за единицу; справа — счётчик «− 1,5 кг +» с количеством
 * посередине и сумма строки под ним. Весовые — шаг 100 г (как в шторке веса), нажатие на вес открывает шторку;
 * на минимуме «−» превращается в «убрать». Сумма коротко подсвечивается, когда меняется.
 */
function CartLine({ l, look, onSet, onEdit }: { l: Line; look?: Look; onSet: (p: CatalogProduct, qty: number) => void; onEdit: (p: CatalogProduct) => void }) {
  const t = useT();
  const lang = useLang();
  const p = l.product;
  const weighted = isWeighted(p.unit);
  const step = weighted ? 100 : 1;
  const atMin = l.qty <= step;
  const sum = lineTiyn(l);
  const [flash, setFlash] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(id);
  }, [sum]);
  const btn: React.CSSProperties = { width: 40, height: 40, border: 'none', borderRadius: 10, background: 'var(--card)', fontSize: 20, cursor: 'pointer', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: look?.tint ?? '#F4F2F0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : look?.pic ? <span aria-hidden="true" style={{ fontSize: 26 }}>{look.pic}</span>
          : <span aria-hidden="true" style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink-60)' }}>{look?.initials}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{localized(p.name, lang)}</div>
        <div className="muted" style={{ fontSize: 12 }}>{tenge(p.priceTiyn)} {perUnit(p.unit, t)}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', background: '#F4F2F0', borderRadius: 12, padding: 3 }}>
          <button aria-label={t.remove} onClick={() => onSet(p, atMin ? 0 : l.qty - step)} style={btn}>
            {atMin
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sale)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>
              : '−'}
          </button>
          {weighted ? (
            <button onClick={() => onEdit(p)} aria-label={t.howMuch}
              style={{ minWidth: 70, height: 40, border: 'none', background: 'transparent', font: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 4, color: 'var(--ink)' }}>
              {qtyLabel(p.unit, l.qty, t)}
            </button>
          ) : (
            <span style={{ minWidth: 56, textAlign: 'center', fontWeight: 800, fontSize: 15 }}>{qtyLabel(p.unit, l.qty, t)}</span>
          )}
          <button aria-label={t.add} onClick={() => onSet(p, l.qty + step)} style={btn}>+</button>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, padding: '0 6px', borderRadius: 6, transition: 'background 0.3s', background: flash ? 'var(--carrot-50)' : 'transparent', color: flash ? 'var(--carrot-600)' : 'var(--ink)' }}>
          {tenge(sum)}
        </div>
      </div>
    </div>
  );
}

function CheckoutDrawer(props: {
  slug: string; store: Catalog['store']; lines: Line[]; subtotal: number;
  looks: Map<string, Look>;
  onClose: () => void; onSet: (p: CatalogProduct, qty: number) => void; onEdit: (p: CatalogProduct) => void;
  onDone: (r: { id: string; number: number; estimatedTiyn: number; deliveryCode?: string }) => void;
}) {
  const { slug, store, lines, subtotal, looks, onClose, onSet, onEdit, onDone } = props;
  const t = useT();
  const lang = useLang();
  // Два вида доставки: магазин сам (по своим зонам; цена и «бесплатно от» — у зоны) и курьерская служба
  // (сторонняя) — по всему городу, за счёт покупателя, в сумму заказа не входит. Доставка может быть выключена.
  const deliveryOn = store.deliveryEnabled !== false;
  const ownOn = deliveryOn && store.deliveryMode !== 'SERVICE';
  const courierOn = deliveryOn && store.deliveryMode !== 'OWN';
  const [mode, setMode] = useState<'OWN' | 'SERVICE' | 'PICKUP'>(ownOn ? 'OWN' : store.pickupEnabled ? 'PICKUP' : 'SERVICE');
  // Номер — не в форме: его спрашивает шторка после «Оформить заказ» (если устройство ещё не подтверждено).
  const [knownPhone, setKnownPhone] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  useEffect(() => { setKnownPhone(readSession()?.phone ?? null); }, []);
  const [line, setLine] = useState('');
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  // Зона доставки магазина для выбранной точки: цена, минимальный заказ или «сюда не доставляем».
  type ZoneInfo = { inZone: boolean; noZones?: boolean; feeTiyn?: number; minOrderTiyn?: number; freeFromTiyn?: number | null };
  const [zone, setZone] = useState<ZoneInfo | null>(null);
  useEffect(() => {
    if (!geo) { setZone(null); return; }
    let stale = false;
    fetch(`${CLIENT_API}/shops/${encodeURIComponent(slug)}/zone-check?lat=${geo.lat}&lng=${geo.lng}`)
      .then((r) => r.json()).then((z) => { if (!stale) setZone(z); }).catch(() => { if (!stale) setZone(null); });
    return () => { stale = true; };
  }, [geo, slug]);
  const delivering = mode !== 'PICKUP';
  const ownDelivery = mode === 'OWN';
  const outOfZone = ownDelivery && zone?.inZone === false;
  const belowMin = ownDelivery && !!zone?.inZone && (zone.minOrderTiyn ?? 0) > subtotal;
  const feeTiyn = ownDelivery && zone?.inZone
    ? (zone.freeFromTiyn != null && subtotal >= zone.freeFromTiyn ? 0 : zone.feeTiyn ?? 0)
    : 0;
  const [mapOpen, setMapOpen] = useState(false);
  const [pickupAt, setPickupAt] = useState('');
  useEffect(() => setPickupAt(''), [mode]);
  const [payChoice, setPay] = useState<'CASH' | 'CARD_COURIER' | 'KASPI_TRANSFER'>('CASH');
  // Курьерская служба денег не берёт — при её доставке только перевод Kaspi (то же правило на сервере).
  const serviceDelivery = mode === 'SERVICE';
  const pay = serviceDelivery ? 'KASPI_TRANSFER' : payChoice;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Самое раннее время получения по настройкам магазина: самовывоз — время сборки,
  // доставка — средний срок своей доставки или передачи курьеру. Локальное 'YYYY-MM-DDTHH:MM'.
  const leadMin = mode === 'PICKUP' ? store.pickupLeadMinutes ?? 60
    : mode === 'SERVICE' ? store.courierHandoverMinutes ?? 30 : store.ownDeliveryMinutes ?? 60;
  const earliest = useMemo(() => {
    const d = new Date(Date.now() + leadMin * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [leadMin]);


  const addrOk = mode === 'PICKUP' || line.trim().length >= 5;
  const pickupOk = !pickupAt || pickupAt >= earliest;
  const canSubmit = lines.length > 0 && addrOk && pickupOk && !outOfZone && !belowMin && !busy;

  async function submit() {
    setErr(null);
    const token = await accessToken();
    if (!token) { setAuthOpen(true); return; }
    await place(token);
  }

  async function place(token: string, retried = false): Promise<void> {
    setBusy(true);
    try {
      const items = lines.map((l) => isWeighted(l.product.unit)
        ? { storeProductId: l.product.id, qtyG: l.qty }
        : { storeProductId: l.product.id, qty: l.qty });
      // Номер заказа сервер берёт из подтверждённого аккаунта (токен).
      const body: any = { storeSlug: slug, payMethod: pay, fulfillment: delivering ? 'DELIVERY' : 'PICKUP', items };
      if (delivering) body.deliveryBy = mode;
      if (delivering) body.address = { line: line.trim(), ...(geo ? { lat: geo.lat, lng: geo.lng } : {}) };
      if (pickupAt) body.pickupAt = new Date(pickupAt).toISOString();
      const r = await fetch(`${CLIENT_API}/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      // Вход истёк: продлеваем один раз, иначе — снова шторка с номером.
      if (r.status === 401) {
        setBusy(false);
        const fresh = retried ? null : await accessToken(true);
        if (fresh) return place(fresh, true);
        setAuthOpen(true);
        return;
      }
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,21,18,0.4)', zIndex: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg)', width: '100%', maxWidth: 'var(--maxw)', borderRadius: '20px 20px 0 0', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg)' }}>
          <h2 style={{ fontSize: 20 }}>{t.cart}</h2>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: '8px 12px' }}>{t.close}</button>
        </div>

        <div style={{ padding: '0 20px' }}>
          {lines.map((l) => <CartLine key={l.product.id} l={l} look={looks.get(l.product.id)} onSet={onSet} onEdit={onEdit} />)}
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Способ получения */}
          <Field label={t.fulfillment}>
            <div style={{ display: 'grid', gap: 8 }}>
              {ownOn ? <ModeBtn active={mode === 'OWN'} onClick={() => setMode('OWN')} icon="🛵" title={t.ownDelivery} sub={t.ownDeliverySub} /> : null}
              {courierOn ? <ModeBtn active={mode === 'SERVICE'} onClick={() => setMode('SERVICE')} icon="🚕" title={t.courierDelivery} sub={t.deliveryCourierSub} /> : null}
              {store.pickupEnabled ? <ModeBtn active={mode === 'PICKUP'} onClick={() => setMode('PICKUP')} icon="🛍️" title={t.pickup} /> : null}
            </div>
          </Field>

          {knownPhone ? (
            <div className="muted" style={{ fontSize: 14 }}>
              {t.orderForPhone(formatKzPhone(knownPhone))} · <button type="button" onClick={() => { saveSession(null); setKnownPhone(null); }}
                style={{ border: 'none', background: 'none', padding: 0, color: 'var(--carrot-600)', font: 'inherit', fontWeight: 700, cursor: 'pointer' }}>{t.changePhone}</button>
            </div>
          ) : null}

          {delivering ? (<>
            {mode !== 'SERVICE' ? null : (
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: '#FFF4D6', color: '#7A5200', fontSize: 14, lineHeight: 1.4 }}>
                🚚 {t.deliveryCourierNote}
              </div>
            )}
            <Field label={t.deliveryAddress}>
              <AddressInput value={line} onChange={setLine} placeholder={t.addressPlaceholder} style={inputStyle(true)} near={store.location ?? null}
                onPick={(address, pt) => { setLine(address); setGeo(pt); }} />
              <button type="button" onClick={() => setMapOpen(true)} className="btn btn-ghost"
                style={{ marginTop: 8, width: '100%', justifyContent: 'center', ...(geo ? { borderColor: 'var(--leaf)', color: 'var(--leaf)' } : {}) }}>
                {geo ? t.changePoint : t.addLocation}
              </button>
              {outOfZone ? (
                <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: '#FBEAEA', color: 'var(--sale)', fontWeight: 700, fontSize: 14 }}>
                  {t.outOfZone}
                  {courierOn ? (
                    <button type="button" onClick={() => setMode('SERVICE')} className="btn btn-ghost"
                      style={{ marginTop: 8, width: '100%', justifyContent: 'center', fontSize: 14 }}>🚕 {t.chooseCourier}</button>
                  ) : null}
                </div>
              ) : ownDelivery && zone?.inZone && !zone.noZones ? (
                <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--leaf-50)', color: 'var(--leaf)', fontWeight: 700, fontSize: 14 }}>
                  {feeTiyn ? t.deliveryCost(tenge(feeTiyn)) : t.freeDelivery}
                  {zone.freeFromTiyn != null && feeTiyn ? <span style={{ fontWeight: 500 }}> · {t.freeFrom(tenge(zone.freeFromTiyn))}</span> : null}
                  {belowMin ? <div style={{ color: 'var(--sale)', marginTop: 4 }}>{t.minOrderNote(tenge(zone.minOrderTiyn ?? 0))}</div> : null}
                </div>
              ) : (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t.locationHint}</div>
              )}
            </Field>
            <Field label={t.deliverWhen}>
              <PickupTimePicker earliest={earliest} hours={store.hours} value={pickupAt} onChange={setPickupAt} asapNote={t.deliverBy} />
            </Field>
          </>) : (
            <Field label={t.pickupWhen}>
              <PickupTimePicker earliest={earliest} hours={store.hours} value={pickupAt} onChange={setPickupAt} asapNote={t.readyBy} />
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                {store.address ? t.pickupFrom(store.address) : t.pickupAddressLater}
              </div>
            </Field>
          )}

          {authOpen ? (
            <AuthSheet initialPhone={knownPhone ? formatKzPhone(knownPhone) : '+7'} onClose={() => setAuthOpen(false)}
              onDone={(s) => { setAuthOpen(false); setKnownPhone(s.phone); place(s.access); }} />
          ) : null}

          {mapOpen ? (
            <MapPicker initial={geo} fallback={store.location ?? null} onClose={() => setMapOpen(false)}
              onPick={(pt, address) => { setGeo(pt); if (address && !line.trim()) setLine(address); setMapOpen(false); }} />
          ) : null}

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

          {/* Чек: товары, доставка и итог — видно, сколько без доставки и сколько с ней. */}
          <div style={{ background: '#F7F4F1', borderRadius: 14, padding: '10px 14px', marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '3px 0' }}>
              <span className="muted">{t.goodsSum}</span><span style={{ fontWeight: 700 }}>≈ {tenge(subtotal)}</span>
            </div>
            {delivering ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, padding: '3px 0' }}>
                <span className="muted">{t.deliveryLine}</span><span style={{ fontWeight: 700 }}>{serviceDelivery ? t.deliveryPaidSeparately : feeTiyn ? tenge(feeTiyn) : zone?.inZone ? t.deliveryFree : '—'}</span>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 8 }}>
              <span style={{ fontWeight: 800 }}>{t.totalSum}</span><span className="price">≈ {tenge(subtotal + feeTiyn)}</span>
            </div>
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

type WeekHours = NonNullable<Catalog['store']['hours']>;
const DEFAULT_WEEK: WeekHours = Array.from({ length: 7 }, () => ({ open: '08:00', close: '22:00' }));
const pad2 = (n: number) => String(n).padStart(2, '0');
const localStamp = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
/** Часы работы на дату (пн — 0). */
const dayHours = (week: WeekHours, d: Date) => week[(d.getDay() + 6) % 7];
/** Магазин работает в этот момент (время покупателя — в Казахстане совпадает с магазином). */
function openAt(week: WeekHours, d: Date): boolean {
  const h = dayHours(week, d);
  const m = d.getHours() * 60 + d.getMinutes();
  return !!h && m >= toMin(h.open) && m < toMin(h.close);
}
/** Длина слота получения, мин (окна по 2 часа от открытия магазина). */
const SLOT_MIN = 120;

/**
 * Время получения слотами по часам работы магазина: «Как можно скорее» (если магазин успевает в рабочее время),
 * затем ближайшие 3 рабочих дня и окна по 2 часа от открытия до закрытия. Значение — начало окна ('YYYY-MM-DDTHH:MM').
 */
function PickupTimePicker({ earliest, hours, value, onChange, asapNote }: { earliest: string; hours?: WeekHours; value: string; onChange: (v: string) => void; asapNote: (time: string) => string }) {
  const t = useT();
  const lang = useLang();
  const week = hours?.length === 7 ? hours : DEFAULT_WEEK;
  const first = new Date(earliest);
  const asapOk = openAt(week, first);
  const slotsOf = (day: Date): { from: Date; to: Date }[] => {
    const h = dayHours(week, day);
    if (!h) return [];
    const out: { from: Date; to: Date }[] = [];
    for (let m = toMin(h.open); m < toMin(h.close); m += SLOT_MIN) {
      const from = new Date(day); from.setHours(0, m, 0, 0);
      const to = new Date(day); to.setHours(0, Math.min(m + SLOT_MIN, toMin(h.close)), 0, 0);
      if (from >= first) out.push({ from, to });
    }
    return out;
  };
  // Ближайшие 3 дня, в которые есть свободные окна (выходные и прошедшее время пропускаем).
  const days: { date: Date; slots: { from: Date; to: Date }[] }[] = [];
  for (let i = 0; i < 14 && days.length < 3; i++) {
    const d = new Date(first); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
    const slots = slotsOf(d);
    if (slots.length) days.push({ date: d, slots });
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [day, setDay] = useState(() => (value ? Math.max(0, days.findIndex((d) => value.startsWith(localStamp(d.date).slice(0, 10)))) : 0));
  // Магазин сейчас не успевает — «как можно скорее» недоступно, сразу предлагаем первое окно.
  useEffect(() => { if (!asapOk && !value && days[0]) onChange(localStamp(days[0].slots[0].from)); });
  const dayLabel = (d: Date) => {
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    return diff === 0 ? t.today : diff === 1 ? t.tomorrow : d.toLocaleDateString(LOCALES[lang], { weekday: 'short', day: 'numeric' });
  };
  const hhmm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const on = (sel: boolean): React.CSSProperties => ({
    borderRadius: 14, font: 'inherit', cursor: 'pointer', color: 'var(--ink)',
    border: sel ? '2px solid var(--carrot)' : '1px solid var(--line)', background: sel ? 'var(--carrot-50)' : 'var(--card)',
  });
  const cur = days[Math.min(day, days.length - 1)];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {asapOk ? (
        <button type="button" onClick={() => onChange('')} style={{ ...on(!value), padding: '12px 14px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <span><span style={{ display: 'block', fontWeight: 800 }}>{t.asap}</span><span className="muted" style={{ fontSize: 13 }}>{asapNote(hhmm(first))}</span></span>
        </button>
      ) : null}
      {/* Дни — вкладками, окна выбранного дня — по 2 часа. */}
      <div style={{ display: 'flex', background: '#F4F2F0', borderRadius: 12, padding: 4, gap: 4 }}>
        {days.map((d, i) => (
          <button key={i} type="button" onClick={() => setDay(i)}
            style={{ flex: 1, height: 38, border: 'none', borderRadius: 9, font: 'inherit', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              background: day === i ? 'var(--card)' : 'transparent', boxShadow: day === i ? '0 1px 3px rgba(0,0,0,.08)' : 'none', color: 'var(--ink)' }}>
            {dayLabel(d.date)}
          </button>
        ))}
      </div>
      {cur ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 232, overflowY: 'auto' }}>
          {cur.slots.map(({ from, to }) => {
            const v = localStamp(from);
            return (
              <button key={v} type="button" onClick={() => onChange(v)} style={{ ...on(value === v), height: 48, fontWeight: 800, fontSize: 15 }}>
                {hhmm(from)} – {hhmm(to)}
              </button>
            );
          })}
        </div>
      ) : <div className="muted" style={{ fontSize: 14, padding: '6px 2px' }}>—</div>}
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

function ModeBtn({ active, onClick, icon, title, sub }: { active: boolean; onClick: () => void; icon: string; title: string; sub?: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, padding: '12px 14px', textAlign: 'left',
      border: `1px solid ${active ? 'var(--carrot)' : 'var(--line)'}`, borderRadius: 'var(--radius-sm)',
      background: active ? 'var(--carrot-50)' : 'var(--card)', color: active ? 'var(--carrot-600)' : 'var(--ink)',
      fontWeight: 700, fontSize: 15,
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
        {title}
        {sub ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-60)' }}>{sub}</span> : null}
      </span>
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

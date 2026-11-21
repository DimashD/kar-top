'use client';

import { useEffect, useState } from 'react';
import {
  StoreApplication, StoreDocKind, listApplications, getApplication, approveApplication, rejectApplication, applicationDocUrl,
} from '../lib/admin';
import { formatKzPhone } from '../lib/phone';

const STATE: Record<string, { label: string; bg: string; fg: string }> = {
  SUBMITTED: { label: 'Готова к проверке', bg: 'var(--leaf-50)', fg: 'var(--leaf)' },
  DRAFT: { label: 'Заполняет магазин', bg: '#FCF4E6', fg: '#8a5a00' },
  REJECTED: { label: 'Отклонена, ждём исправлений', bg: '#FBE9E7', fg: 'var(--sale)' },
  APPROVED: { label: 'Одобрена', bg: 'var(--leaf-50)', fg: 'var(--leaf)' },
};
const DOC: Record<StoreDocKind, string> = { SIGN_PHOTO: 'Вывеска', INSIDE_PHOTO: 'Внутри', CONTRACT: 'Договор', ID_CARD: 'Удостоверение' };

function missing(a: StoreApplication) {
  const m: string[] = [];
  if (!a.checks.data) m.push('данные');
  if (!a.checks.photos) m.push('фото магазина');
  if (!a.checks.contract) m.push('договор');
  return m;
}

function Doc({ storeId, id, label }: { storeId: string; id: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    applicationDocUrl(storeId, id).then((x) => { u = x; setUrl(x); }).catch(() => {});
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [storeId, id]);
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" style={{ display: 'block', width: 140 }}>
      <div style={{ width: 140, height: 110, borderRadius: 10, background: '#f1efe8', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {url ? <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="muted" style={{ fontSize: 12 }}>…</span>}
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{label}</div>
    </a>
  );
}

/** Очередь заявок магазинов: слева список, справа карточка с проверками, фото и кнопками «Одобрить» / «Отклонить». */
export default function AdminApplications() {
  const [list, setList] = useState<StoreApplication[] | null>(null);
  const [sel, setSel] = useState<StoreApplication | null>(null);
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = () => listApplications().then(setList).catch((e) => setErr((e as Error).message));
  useEffect(() => { reload(); }, []);

  async function open(id: string) {
    setErr(null); setRejecting(false); setReason('');
    try { setSel(await getApplication(id)); } catch (e) { setErr((e as Error).message); }
  }

  async function act(f: () => Promise<StoreApplication>) {
    setErr(null); setBusy(true);
    try { setSel(await f()); setRejecting(false); setReason(''); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (!list) return <p className="muted">{err ?? 'Загружаем заявки…'}</p>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
      <div className="card">
        <div style={{ padding: '12px 14px', fontWeight: 800, borderBottom: '1px solid var(--line)' }}>Заявки магазинов · {list.length}</div>
        {list.length === 0 ? <p className="muted" style={{ padding: 14 }}>Новых заявок нет.</p> : list.map((a) => {
          const st = STATE[a.state];
          const m = missing(a);
          return (
            <button key={a.id} onClick={() => open(a.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 0, borderBottom: '1px solid var(--line)', background: sel?.id === a.id ? 'var(--carrot-50)' : 'transparent', cursor: 'pointer', font: 'inherit' }}>
              <div style={{ fontWeight: 700 }}>{a.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{a.legalName ?? '—'} · {new Date(a.createdAt).toLocaleDateString('ru-RU')}</div>
              <span className="badge" style={{ background: st.bg, color: st.fg, marginTop: 4 }}>{a.state === 'DRAFT' && m.length ? `Нет: ${m.join(', ')}` : st.label}</span>
            </button>
          );
        })}
      </div>

      {!sel ? <p className="muted">Выберите заявку слева.</p> : (
        <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 18 }}>{sel.name}</strong>
            <span className="muted">{sel.owner ? `${sel.owner.name ? `${sel.owner.name}, ` : ''}${formatKzPhone(sel.owner.phone)}` : ''}</span>
          </div>
          <span className="badge" style={{ background: STATE[sel.state].bg, color: STATE[sel.state].fg, alignSelf: 'flex-start' }}>{STATE[sel.state].label}</span>
          {sel.applicationRejectReason ? <p style={{ margin: 0 }}>Причина отказа: {sel.applicationRejectReason}</p> : null}

          <section>
            <div className="muted" style={{ fontSize: 13 }}>Данные</div>
            <div>{sel.legalName} · {sel.binKind === 'BIN' ? 'БИН' : 'ИИН'} {sel.legalBin}</div>
            <div>{sel.address}</div>
            <div style={{ color: sel.checks.bin ? 'var(--leaf)' : 'var(--sale)', fontSize: 14 }}>
              {sel.checks.bin ? '✓ Номер ИИН/БИН корректный' : '✗ Номер ИИН/БИН некорректный'}
              {' · '}
              <a href="https://stat.gov.kz/" target="_blank" rel="noreferrer">проверить, что ИП/ТОО действует</a>
            </div>
          </section>

          {(['CONTRACT', 'ID_CARD', 'SIGN_PHOTO', 'INSIDE_PHOTO'] as StoreDocKind[]).map((k) => {
            const docs = (sel.documents ?? []).filter((d) => d.kind === k);
            return (
              <section key={k}>
                <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{DOC[k]}{k === 'CONTRACT' || k === 'ID_CARD' ? ' — сверьте ФИО, ИИН/БИН и подпись' : ''}</div>
                {docs.length ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {docs.map((d, i) => <Doc key={d.id} storeId={sel.id} id={d.id} label={`${DOC[k]}${docs.length > 1 ? ` ${i + 1}` : ''}`} />)}
                  </div>
                ) : <span style={{ color: 'var(--sale)', fontSize: 14 }}>Не загружено</span>}
              </section>
            );
          })}

          <section>
            <div className="muted" style={{ fontSize: 13 }}>Витрина</div>
            <div>{sel.productCount} товаров · <a href={`/${sel.slug}`} target="_blank" rel="noreferrer">открыть витрину</a></div>
          </section>

          {sel.state !== 'APPROVED' ? (
            rejecting ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Например: фото договора нечёткое, переснимите вторую страницу"
                  style={{ padding: 10, borderRadius: 10, border: '1px solid var(--line)', font: 'inherit' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => setRejecting(false)} disabled={busy}>Отмена</button>
                  <button className="btn btn-primary" disabled={busy || reason.trim().length < 3} onClick={() => act(() => rejectApplication(sel.id, reason.trim()))}>Отправить магазину</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={() => setRejecting(true)} disabled={busy}>Отклонить с причиной</button>
                <button className="btn btn-primary" disabled={busy || !sel.ready} onClick={() => act(() => approveApplication(sel.id))}
                  title={sel.ready ? '' : 'Магазин ещё не загрузил всё нужное'}>Одобрить</button>
              </div>
            )
          ) : null}
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>После одобрения договор отмечается как подписанный на бумаге, магазин начинает работать по ссылке. Показ всем включается в разделе «Магазины».</p>
          {err ? <p style={{ color: 'var(--sale)', margin: 0 }}>{err}</p> : null}
        </div>
      )}
    </div>
  );
}

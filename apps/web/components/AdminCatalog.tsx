'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Category, MasterProduct, Unit, UNIT_LABEL, CatalogRequest,
  listCategories, createCategory, deleteCategory,
  listMasterProducts, createProduct, deleteProduct,
  listCatalogRequests, approveCatalogRequest, rejectCatalogRequest, UnauthorizedError,
} from '../lib/admin';
import { useAdmin } from './AdminShell';

const input: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 15, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit' };

export default function AdminCatalog() {
  const { signOut } = useAdmin();
  const [cats, setCats] = useState<Category[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // новая категория
  const [catName, setCatName] = useState('');
  const [catPerish, setCatPerish] = useState(false);

  // новый товар
  const [pName, setPName] = useState('');
  const [pUnit, setPUnit] = useState<Unit>('KG');
  const [pStep, setPStep] = useState('');
  const [pAvg, setPAvg] = useState('');
  const [busy, setBusy] = useState(false);

  // заявки магазинов
  const [reqs, setReqs] = useState<CatalogRequest[]>([]);
  const [reqBusy, setReqBusy] = useState<string | null>(null);

  const handle = useCallback((e: unknown) => {
    if (e instanceof UnauthorizedError) signOut(); else setErr((e as Error).message);
  }, [signOut]);

  const loadCats = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const c = await listCategories();
      setCats(c);
      setSel((s) => s ?? (c[0]?.id ?? null));
    } catch (e) { handle(e); } finally { setLoading(false); }
  }, [handle]);

  const loadProducts = useCallback(async (catId: string) => {
    setErr(null);
    try { setProducts(await listMasterProducts(catId)); } catch (e) { handle(e); }
  }, [handle]);

  const loadReqs = useCallback(async () => {
    try { setReqs(await listCatalogRequests('PENDING')); } catch (e) { handle(e); }
  }, [handle]);

  useEffect(() => { loadCats(); loadReqs(); }, [loadCats, loadReqs]);
  useEffect(() => { if (sel) loadProducts(sel); }, [sel, loadProducts]);

  async function resolveReq(id: string, action: 'approve' | 'reject') {
    setReqBusy(id); setErr(null);
    try {
      if (action === 'approve') await approveCatalogRequest(id); else await rejectCatalogRequest(id);
      await loadReqs();
      if (action === 'approve') { await loadCats(); if (sel) await loadProducts(sel); }
    } catch (e) { handle(e); } finally { setReqBusy(null); }
  }

  async function addCat() {
    if (catName.trim().length < 2) return;
    setBusy(true); setErr(null);
    try {
      const c = await createCategory({ name: { ru: catName.trim() }, perishable: catPerish });
      setCatName(''); setCatPerish(false);
      await loadCats(); setSel(c.id);
    } catch (e) { handle(e); } finally { setBusy(false); }
  }
  async function removeCat(id: string) {
    if (!window.confirm('Удалить категорию? (должна быть пустой)')) return;
    setErr(null);
    try { await deleteCategory(id); if (sel === id) setSel(null); await loadCats(); } catch (e) { handle(e); }
  }

  async function addProduct() {
    if (!sel || pName.trim().length < 2) return;
    setBusy(true); setErr(null);
    try {
      await createProduct({
        categoryId: sel, name: { ru: pName.trim() }, unit: pUnit,
        stepG: pStep ? Number(pStep) : undefined, avgPieceG: pAvg ? Number(pAvg) : undefined,
      });
      setPName(''); setPStep(''); setPAvg('');
      await loadProducts(sel); await loadCats();
    } catch (e) { handle(e); } finally { setBusy(false); }
  }
  async function removeProduct(id: string) {
    if (!window.confirm('Удалить товар из мастер-каталога?')) return;
    setErr(null);
    try { await deleteProduct(id); if (sel) { await loadProducts(sel); await loadCats(); } } catch (e) { handle(e); }
  }

  const weighted = pUnit === 'KG' || pUnit === 'G';

  return (
    <div className="container" style={{ padding: '24px 20px 56px', maxWidth: 920 }}>
      <h1 style={{ fontSize: 26, margin: '0 0 4px' }}>Мастер-каталог</h1>
      <p className="muted" style={{ margin: '0 0 20px', fontSize: 15 }}>
        Общий справочник товаров платформы. Магазины выбирают товары отсюда и ставят свои цены.
      </p>

      {err ? <p style={{ color: 'var(--sale)' }}>{err}</p> : null}

      {/* Заявки магазинов на каталог */}
      {reqs.length > 0 ? (
        <div className="card" style={{ padding: 18, marginBottom: 20, background: 'var(--carrot-50)', borderColor: 'var(--carrot)' }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>
            Заявки магазинов ({reqs.length})
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {reqs.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 12px', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ minWidth: 200 }}>
                  <span style={{ fontWeight: 700 }}>{r.name}</span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {' · '}{r.type === 'CATEGORY' ? 'категория' : 'товар'}
                    {r.type === 'PRODUCT' && r.unit ? `, ${UNIT_LABEL[r.unit]}` : ''}
                    {r.type === 'PRODUCT' && r.categoryName ? `, в «${r.categoryName}»` : ''}
                  </span>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    от {r.store?.name ?? 'магазина'}{r.note ? ` · «${r.note}»` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" disabled={reqBusy === r.id} onClick={() => resolveReq(r.id, 'approve')} style={{ padding: '6px 12px', fontSize: 13 }}>Одобрить</button>
                  <button className="btn btn-ghost" disabled={reqBusy === r.id} onClick={() => resolveReq(r.id, 'reject')} style={{ padding: '6px 12px', fontSize: 13, color: 'var(--sale)' }}>Отклонить</button>
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>«Одобрить» создаёт категорию/товар в каталоге автоматически.</p>
        </div>
      ) : null}

      {/* Категории */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>Категории</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {loading ? <span className="muted">Загрузка…</span> : cats.length === 0 ? <span className="muted">Нет категорий.</span> :
            cats.map((c) => (
              <button key={c.id} onClick={() => setSel(c.id)}
                className={sel === c.id ? 'btn btn-primary' : 'btn btn-ghost'}
                style={{ padding: '8px 14px', fontSize: 14 }}>
                {c.name.ru} {c._count ? <span style={{ opacity: 0.7 }}>· {c._count.products}</span> : null}
              </button>
            ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Новая категория (напр. «Овощи»)" style={{ ...input, maxWidth: 260 }} />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
            <input type="checkbox" checked={catPerish} onChange={(e) => setCatPerish(e.target.checked)} /> скоропорт
          </label>
          <button className="btn btn-primary" disabled={busy || catName.trim().length < 2} onClick={addCat} style={{ padding: '8px 14px', fontSize: 14 }}>Добавить</button>
          {sel ? <button className="btn btn-ghost" onClick={() => removeCat(sel)} style={{ padding: '8px 14px', fontSize: 14, color: 'var(--sale)', marginLeft: 'auto' }}>Удалить выбранную</button> : null}
        </div>
      </div>

      {/* Товары выбранной категории */}
      {sel ? (
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 10 }}>
            Товары · {cats.find((c) => c.id === sel)?.name.ru ?? ''}
          </div>

          {/* Форма добавления товара */}
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 14, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Название</label>
              <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Напр. «Яблоко Гала»" style={input} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Единица</label>
              <select value={pUnit} onChange={(e) => setPUnit(e.target.value as Unit)} style={{ ...input, cursor: 'pointer' }}>
                {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
              </select>
            </div>
            {weighted ? (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Шаг, г</label>
                <input value={pStep} onChange={(e) => setPStep(e.target.value)} inputMode="numeric" placeholder="напр. 500" style={input} />
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>≈ вес 1 шт, г</label>
                <input value={pAvg} onChange={(e) => setPAvg(e.target.value)} inputMode="numeric" placeholder="напр. 180" style={input} />
              </div>
            )}
            <button className="btn btn-primary" disabled={busy || pName.trim().length < 2} onClick={addProduct} style={{ height: 40 }}>Добавить товар</button>
          </div>

          {products.length === 0 ? <div className="muted">В этой категории пока нет товаров.</div> : (
            <div style={{ display: 'grid', gap: 8 }}>
              {products.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{p.name.ru}</span>
                    <span className="muted" style={{ fontSize: 13 }}> · {UNIT_LABEL[p.unit]}{p.stepG ? `, шаг ${p.stepG} г` : ''}{p.avgPieceG ? `, ~${p.avgPieceG} г/шт` : ''}{p.perishable ? ' · скоропорт' : ''}</span>
                    {p._count && p._count.storeProducts > 0 ? <span className="muted" style={{ fontSize: 12 }}> · в {p._count.storeProducts} магаз.</span> : null}
                  </div>
                  <button className="btn btn-ghost" onClick={() => removeProduct(p.id)} style={{ padding: '4px 10px', fontSize: 13, color: 'var(--sale)' }}>Удалить</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

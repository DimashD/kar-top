import Link from 'next/link';

// Лендинг Kartop. Витрина магазина — /<slug>.
const CATS = [
  { emoji: '🥕', name: 'Овощи' },
  { emoji: '🍎', name: 'Фрукты' },
  { emoji: '🥩', name: 'Мясо' },
  { emoji: '🧀', name: 'Молочка' },
  { emoji: '🥗', name: 'Корейские салаты' },
  { emoji: '🥜', name: 'Орехи и сухофрукты' },
];

const STEPS = [
  { n: '1', t: 'Выберите магазин', d: 'Зелёный базар вашего района — рядом с домом.' },
  { n: '2', t: 'Соберите корзину', d: 'Весовые товары взвесят при сборке, сумма уточнится.' },
  { n: '3', t: 'Оплата при получении', d: 'Наличными, картой курьеру или переводом Kaspi.' },
];

export default function Home() {
  return (
    <main>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ fontWeight: 900, fontSize: 24, color: 'var(--carrot)' }}>Kartop</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn btn-ghost" href="/app">Приложение</Link>
            <Link className="btn btn-primary" href="/ruslan-fruits">Открыть витрину</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container" style={{ padding: '56px 20px 40px' }}>
        <div style={{ maxWidth: 640 }}>
          <span className="badge badge-leaf">Алматы · Астана</span>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: '16px 0 12px' }}>
            Зелёный базар рядом — <span style={{ color: 'var(--carrot)' }}>со свежестью рынка</span>
          </h1>
          <p className="muted" style={{ fontSize: 19, margin: '0 0 24px' }}>
            Овощи, фрукты, мясо, молочка, корейские салаты и всё с базара — из проверенных
            магазинов вашего района, с доставкой или самовывозом.
          </p>
          <Link className="btn btn-primary" href="/ruslan-fruits" style={{ fontSize: 16, padding: '14px 24px' }}>
            Смотреть магазины →
          </Link>
        </div>
      </section>

      {/* Категории */}
      <section className="container" style={{ paddingBottom: 48 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {CATS.map((c) => (
            <div key={c.name} className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 30 }}>{c.emoji}</span>
              <span style={{ fontWeight: 700 }}>{c.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Как это работает */}
      <section style={{ background: 'var(--card)', borderTop: '1px solid var(--line)' }}>
        <div className="container" style={{ padding: '48px 20px' }}>
          <h2 style={{ fontSize: 28, marginBottom: 24 }}>Как это работает</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {STEPS.map((s) => (
              <div key={s.n}>
                <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--carrot-50)', color: 'var(--carrot-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: 12 }}>{s.n}</div>
                <h3 style={{ fontSize: 18, marginBottom: 6 }}>{s.t}</h3>
                <p className="muted" style={{ margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="container" style={{ padding: '32px 20px', color: 'var(--ink-40)', fontSize: 14 }}>
        Kartop · онлайн зелёный базар · Казахстан
      </footer>
    </main>
  );
}

import Link from 'next/link';
import PartnerForm from '../../components/PartnerForm';

export const metadata = {
  title: 'Стать партнёром — Kartop',
  description: 'Подключите свой магазин с зелёного базара к Kartop: онлайн-витрина, заказы и доставка. Оставьте заявку — мы свяжемся с вами.',
};

const PERKS = [
  { emoji: '🛒', t: 'Онлайн-витрина', d: 'Ваш ассортимент в приложении и на сайте — клиенты района находят вас сами.' },
  { emoji: '📦', t: 'Заказы и сборка', d: 'Приложение магазина: уведомления о заказах, сборка, доставка и самовывоз.' },
  { emoji: '💳', t: 'Оплата как удобно', d: 'Наличные, карта курьеру или перевод Kaspi — без лишних комиссий на старте.' },
];

export default function PartnerPage() {
  return (
    <main>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <Link href="/" style={{ fontWeight: 900, fontSize: 24, color: 'var(--carrot)', textDecoration: 'none' }}>Kartop</Link>
          <Link className="btn btn-ghost" href="/">На главную</Link>
        </div>
      </header>

      <section className="container" style={{ padding: '48px 20px 24px' }}>
        <div style={{ maxWidth: 640 }}>
          <span className="badge badge-leaf">Для магазинов</span>
          <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: '16px 0 12px' }}>
            Выведите свой магазин <span style={{ color: 'var(--carrot)' }}>в онлайн</span>
          </h1>
          <p className="muted" style={{ fontSize: 18, margin: 0 }}>
            Kartop — онлайн зелёный базар Алматы и Астаны. Подключаем проверенные магазины:
            витрина, заказы, доставка и самовывоз в одном приложении.
          </p>
        </div>
      </section>

      <section className="container" style={{ paddingBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {PERKS.map((p) => (
            <div key={p.t} className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>{p.emoji}</div>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>{p.t}</h3>
              <p className="muted" style={{ margin: 0, fontSize: 15 }}>{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: '16px 20px 56px' }}>
        <PartnerForm />
      </section>

      <footer className="container" style={{ padding: '32px 20px', color: 'var(--ink-40)', fontSize: 14 }}>
        Kartop · онлайн зелёный базар · Казахстан
      </footer>
    </main>
  );
}

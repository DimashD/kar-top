import Link from 'next/link';
import AppBanner from '../../components/AppBanner';

export const metadata = {
  title: 'Скачать приложение Kartop',
  description: 'Приложение Kartop: заказывайте продукты с зелёного базара, следите за заказом и получайте уведомления.',
};

export default function AppPage() {
  return (
    <main>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: 64 }}>
          <Link href="/" style={{ fontWeight: 900, fontSize: 24, color: 'var(--carrot)' }}>Kartop</Link>
        </div>
      </header>
      <section className="container" style={{ padding: '56px 20px' }}>
        <AppBanner variant="full" />
      </section>
    </main>
  );
}

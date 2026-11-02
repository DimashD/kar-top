import Link from 'next/link';
import AppBanner from '../../components/AppBanner';

export const metadata = {
  title: 'Kartop в браузере и приложении (Android)',
  description: 'Заказывайте продукты с зелёного базара прямо в браузере. Для живого статуса заказа и уведомлений есть приложение для Android.',
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

import AdminShell from '../../../components/AdminShell';
import AdminOrders from '../../../components/AdminOrders';

export const metadata = { title: 'Заказы — Kartop Admin', robots: { index: false, follow: false } };

export default function AdminOrdersPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <AdminShell><AdminOrders /></AdminShell>
    </main>
  );
}

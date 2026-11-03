import AdminShell from '../../../components/AdminShell';
import AdminStores from '../../../components/AdminStores';

export const metadata = { title: 'Магазины — Kartop Admin', robots: { index: false, follow: false } };

export default function AdminStoresPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <AdminShell><AdminStores /></AdminShell>
    </main>
  );
}

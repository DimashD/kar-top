import AdminShell from '../../../components/AdminShell';
import AdminCatalog from '../../../components/AdminCatalog';

export const metadata = { title: 'Каталог — Kartop Admin', robots: { index: false, follow: false } };

export default function AdminCatalogPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <AdminShell><AdminCatalog /></AdminShell>
    </main>
  );
}

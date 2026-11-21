import AdminShell from '../../../components/AdminShell';
import AdminApplications from '../../../components/AdminApplications';

export const metadata = { title: 'Заявки магазинов — Kartop Admin', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <AdminShell><AdminApplications /></AdminShell>
    </main>
  );
}

import AdminShell from '../../../components/AdminShell';
import AdminLeads from '../../../components/AdminLeads';

export const metadata = {
  title: 'Заявки партнёров — Kartop Admin',
  robots: { index: false, follow: false },
};

export default function AdminPartnersPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <AdminShell><AdminLeads /></AdminShell>
    </main>
  );
}

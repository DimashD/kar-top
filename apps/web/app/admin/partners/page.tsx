import AdminLeads from '../../../components/AdminLeads';

export const metadata = {
  title: 'Заявки партнёров — Kartop Admin',
  robots: { index: false, follow: false }, // админку не индексируем
};

export default function AdminPartnersPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <AdminLeads />
    </main>
  );
}

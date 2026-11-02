import AdminShell from '../../../components/AdminShell';
import AdminStaff from '../../../components/AdminStaff';

export const metadata = {
  title: 'Сотрудники — Kartop Admin',
  robots: { index: false, follow: false },
};

export default function AdminStaffPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <AdminShell><AdminStaff /></AdminShell>
    </main>
  );
}

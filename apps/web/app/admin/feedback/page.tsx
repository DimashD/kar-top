import AdminShell from '../../../components/AdminShell';
import AdminFeedback from '../../../components/AdminFeedback';

export const metadata = {
  title: 'Обратная связь — Kartop Admin',
  robots: { index: false, follow: false },
};

export default function AdminFeedbackPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <AdminShell><AdminFeedback /></AdminShell>
    </main>
  );
}

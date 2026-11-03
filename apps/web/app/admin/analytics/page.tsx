import AdminShell from '../../../components/AdminShell';
import AdminAnalytics from '../../../components/AdminAnalytics';

export const metadata = { title: 'Аналитика — Kartop Admin', robots: { index: false, follow: false } };

export default function AdminAnalyticsPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <AdminShell><AdminAnalytics /></AdminShell>
    </main>
  );
}

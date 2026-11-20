import AdminShell from '../../../components/AdminShell';
import AdminTariffs from '../../../components/AdminTariffs';

export const metadata = { title: 'Тарифы — Kartop Admin', robots: { index: false, follow: false } };

export default function Page() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <AdminShell><AdminTariffs /></AdminShell>
    </main>
  );
}

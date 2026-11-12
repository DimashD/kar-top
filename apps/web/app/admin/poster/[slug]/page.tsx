import StorePoster from '../../../../components/StorePoster';

export const metadata = { title: 'QR-постер — Kartop Admin', robots: { index: false, follow: false } };

// Постер для печати (A4): название магазина, QR на витрину и призыв заказывать онлайн. Открывается из админки → Магазины.
export default function StorePosterPage({ params }: { params: { slug: string } }) {
  return <StorePoster slug={params.slug} />;
}

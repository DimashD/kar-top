// Витрина магазина по короткой ссылке kartop.kz/<slug> (SSR).
// TODO: загрузка каталога из API /api/shops/<slug>/catalog, корзина, оформление.
export default function StorePage({ params }: { params: { slug: string } }) {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 32, fontWeight: 800 }}>Витрина: {params.slug}</h1>
      <p style={{ color: '#9A8F88' }}>Каркас. Дизайн — артборды WebStore / Store в /design.</p>
    </main>
  );
}

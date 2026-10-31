// Лендинг. Витрина магазина — /[slug] (SSR, SEO, OpenGraph).
export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }}>Kartop</h1>
      <p style={{ fontSize: 18, color: '#6B5F57' }}>
        Онлайн зелёный базар: овощи, фрукты, мясо, молочка, корейские салаты и всё с рынка —
        из магазинов вашего района, с доставкой или самовывозом.
      </p>
      <p style={{ color: '#9A8F88' }}>Каркас веб-витрины. Экраны — см. макеты в /design.</p>
    </main>
  );
}

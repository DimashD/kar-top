import Link from 'next/link';

export const metadata = { title: 'Пользовательское соглашение — Kartop', robots: { index: true } };

// Черновик пользовательского соглашения. Перед публикацией — проверить с юристом.
export default function TermsPage() {
  return (
    <main>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: 64 }}>
          <Link href="/" style={{ fontWeight: 900, fontSize: 24, color: 'var(--carrot)' }}>Kartop</Link>
        </div>
      </header>
      <article className="container" style={{ maxWidth: 760, padding: '32px 20px', lineHeight: 1.65 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Пользовательское соглашение</h1>
        <p className="muted" style={{ marginBottom: 24 }}>Условия использования сервиса Kartop. Редакция от 2026 г.</p>

        <S t="1. Общие положения">Kartop — платформа, соединяющая покупателей с магазинами зелёного базара для заказа и доставки/самовывоза продуктов. Используя Сервис, вы принимаете настоящие условия.</S>
        <S t="2. Заказы и оплата">Сумма заказа — предварительная; для весовых товаров уточняется после взвешивания. Оплата — при получении (наличные, карта курьеру, перевод Kaspi) либо онлайн (при подключении). Код получения подтверждает передачу заказа.</S>
        <S t="3. Магазины">За качество, состав, цены и наличие товаров отвечает магазин, исполняющий заказ. Kartop предоставляет платформу и сервисы доставки/уведомлений.</S>
        <S t="4. Отмена и возврат">Правила отмены и возврата зависят от статуса заказа и политики магазина. При отсутствии товара предлагается замена или исключение позиции.</S>
        <S t="5. Ответственность">Сервис предоставляется «как есть». Kartop не несёт ответственности за действия магазинов и курьеров сверх пределов, установленных законодательством РК.</S>
        <S t="6. Контакты">Поддержка: support@kartop.kz.</S>

        <p className="muted" style={{ fontSize: 13, marginTop: 24 }}>Документ является шаблоном и требует проверки юристом перед публикацией.</p>
        <p style={{ marginTop: 20 }}><Link className="btn btn-ghost" href="/">На главную</Link></p>
      </article>
    </main>
  );
}

function S({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 19, marginBottom: 6 }}>{t}</h2>
      <p className="muted" style={{ color: 'var(--ink)' }}>{children}</p>
    </section>
  );
}

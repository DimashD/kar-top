import Logo from '../../components/Logo';
import Link from 'next/link';

export const metadata = { title: 'Политика конфиденциальности — Kartop', robots: { index: true } };

// Черновик политики конфиденциальности. Перед публикацией в сторы — проверить с юристом.
export default function PrivacyPage() {
  return (
    <main>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: 64 }}>
          <Logo size={28} />
        </div>
      </header>
      <article className="container" style={{ maxWidth: 760, padding: '32px 20px', lineHeight: 1.65 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Политика конфиденциальности</h1>
        <p className="muted" style={{ marginBottom: 24 }}>Онлайн зелёный базар Kartop (далее — «Сервис»). Редакция от 2026 г.</p>

        <Section title="1. Какие данные мы обрабатываем">
          <ul>
            <li>Контактные данные: номер телефона, email (если указан), имя.</li>
            <li>Данные заказа: состав, адрес доставки или точка самовывоза, способ оплаты, история заказов.</li>
            <li>Примерная геолокация, если вы разрешили её в приложении/браузере (для зоны доставки).</li>
            <li>Технические данные устройства и push-токен (для уведомлений).</li>
          </ul>
        </Section>
        <Section title="2. Зачем мы их обрабатываем">
          <ul>
            <li>Оформление, сборка и доставка заказов, связь по заказу.</li>
            <li>Подтверждение входа (коды), уведомления о статусе заказа.</li>
            <li>Улучшение сервиса, аналитика в обезличенном виде, поддержка.</li>
          </ul>
        </Section>
        <Section title="3. Кому передаются данные">
          <p>Магазину, исполняющему ваш заказ, — минимально необходимое: состав заказа, а точные
          контакты и адрес — только после принятия заказа магазином. Курьеру — для доставки.
          Поставщикам инфраструктуры (связь, облако) — в объёме, нужном для работы Сервиса.
          Третьим лицам в рекламных целях данные не продаются.</p>
        </Section>
        <Section title="4. Хранение и защита">
          <p>Персональные данные граждан Республики Казахстан хранятся на серверах в Казахстане
          согласно законодательству РК о персональных данных. Доступ ограничен, передача —
          по защищённому соединению.</p>
        </Section>
        <Section title="5. Ваши права">
          <p>Вы можете запросить доступ, исправление или удаление своих данных, отозвать согласие.
          Для этого напишите в поддержку (контакты ниже). Удаление аккаунта влечёт удаление
          связанных персональных данных, кроме тех, что мы обязаны хранить по закону.</p>
        </Section>
        <Section title="6. Уведомления">
          <p>Push-уведомления и сообщения о заказе можно отключить в настройках устройства/приложения.</p>
        </Section>
        <Section title="7. Контакты">
          <p>По вопросам обработки данных: support@kartop.kz.</p>
        </Section>

        <p className="muted" style={{ fontSize: 13, marginTop: 24 }}>
          Документ является шаблоном и требует проверки юристом перед публикацией.
        </p>
        <p style={{ marginTop: 20 }}><Link className="btn btn-ghost" href="/">На главную</Link></p>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 19, marginBottom: 6 }}>{title}</h2>
      <div className="muted" style={{ color: 'var(--ink)' }}>{children}</div>
    </section>
  );
}

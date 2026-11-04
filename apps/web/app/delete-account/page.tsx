import Link from 'next/link';

export const metadata = {
  title: 'Удаление аккаунта и данных — Kartop',
  description: 'Как запросить удаление аккаунта и персональных данных в Kartop.',
  robots: { index: true },
};

export default function DeleteAccountPage() {
  return (
    <main>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--card)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: 64 }}>
          <Link href="/" style={{ fontWeight: 900, fontSize: 24, color: 'var(--carrot)' }}>Kartop</Link>
        </div>
      </header>
      <article className="container" style={{ maxWidth: 760, padding: '32px 20px', lineHeight: 1.65 }}>
        <h1 style={{ fontSize: 30, marginBottom: 8 }}>Удаление аккаунта и данных</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Сервис Kartop (приложения «Kartop» и «Kartop Магазин», сайт kar-top.kz).
        </p>

        <Section title="Как запросить удаление">
          <p>Чтобы удалить свой аккаунт и персональные данные, напишите на
          {' '}<a href="mailto:support@kar-top.kz" style={{ color: 'var(--carrot-600)' }}>support@kar-top.kz</a>
          {' '}с номера телефона или email, привязанного к аккаунту, и укажите в теме «Удаление аккаунта».
          Также запрос можно оставить через поддержку в приложении.</p>
        </Section>

        <Section title="Какие данные удаляются">
          <ul>
            <li>Аккаунт и профиль (имя, номер телефона, email, если был привязан);</li>
            <li>История заказов и связанные с ней персональные данные;</li>
            <li>Push-токены устройства и настройки уведомлений.</li>
          </ul>
        </Section>

        <Section title="Что может храниться дольше">
          <p>Данные, которые мы обязаны хранить по законодательству Республики Казахстан
          (например, документы по совершённым сделкам для бухгалтерского и налогового учёта),
          сохраняются в течение установленного законом срока в минимально необходимом объёме,
          после чего удаляются.</p>
        </Section>

        <Section title="Сроки">
          <p>Запрос обрабатывается в течение 30 дней с момента подтверждения, что вы — владелец аккаунта.</p>
        </Section>

        <Section title="Контакты">
          <p>По вопросам удаления данных: <a href="mailto:support@kar-top.kz" style={{ color: 'var(--carrot-600)' }}>support@kar-top.kz</a>.</p>
        </Section>

        <p style={{ marginTop: 20 }}>
          <Link className="btn btn-ghost" href="/privacy">Политика конфиденциальности</Link>
        </p>
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

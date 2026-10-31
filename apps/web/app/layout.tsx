import type { ReactNode } from 'react';

export const metadata = {
  title: 'Kartop — зелёный базар рядом',
  description: 'Свежие продукты с рынка: доставка и самовывоз из магазинов вашего района.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, fontFamily: "'Golos Text', system-ui, sans-serif", color: '#1A1512' }}>
        {children}
      </body>
    </html>
  );
}

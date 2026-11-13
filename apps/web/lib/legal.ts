// Реквизиты владельца Kartop и редакции документов — ОДНО место для всех юридических страниц.
// Квадратные скобки [ ] = ещё не заполнено: подставить данные ИП/ТОО перед публикацией на проде.
export const LEGAL = {
  operator: '[ИП / ТОО «…»]',
  bin: '[ИИН/БИН]',
  address: '[юридический адрес]',
  bank: '[банк, БИК, IBAN]',
  phone: '[телефон поддержки]',
  email: '[почта поддержки]',
  responsible: '[ФИО ответственного за персональные данные]',
  hosting: '[хостинг в РК]',
  city: 'Алматы',
};

// Дата редакции — та же, что LEGAL_VERSIONS в API (apps/api/src/modules/legal/legal-versions.ts).
export const LEGAL_EDITION = '13.11.2026';

/** Строка реквизитов для подвала и шапок документов. */
export const requisites = () => `${LEGAL.operator}, ${LEGAL.bin}, ${LEGAL.address}`;

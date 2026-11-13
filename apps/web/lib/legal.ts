// Реквизиты владельца Kartop и редакции документов — ОДНО место для всех юридических страниц.
export const LEGAL = {
  operator: 'ИП «Easy Buy»',
  bin: 'ИИН 890726300020',
  address: 'г. Алматы, мкр. Коктем-1, д. 50',
  bank: 'АО «Kaspi Bank», БИК CASPKZKA, IBAN KZ37722S000007071155',
  phone: '+7 702 730 23 90',
  email: 'kartop.shop@gmail.com',
  hosting: 'hoster.kz, Казахстан',
  city: 'Алматы',
};

// Дата редакции — та же, что LEGAL_VERSIONS в API (apps/api/src/modules/legal/legal-versions.ts).
export const LEGAL_EDITION = '13.11.2026';

/** Строка реквизитов для подвала и шапок документов. */
export const requisites = () => `${LEGAL.operator}, ${LEGAL.bin}, ${LEGAL.address}`;

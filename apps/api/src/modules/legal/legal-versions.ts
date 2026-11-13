// Действующие редакции документов. Новая редакция = новая строка здесь + новый текст на сайте:
// у кого принята старая редакция, приложение и сайт попросят принять заново.
export const LEGAL_VERSIONS = {
  TERMS: '2026-11-13',
  PD_CONSENT: '2026-11-13',
  MERCHANT_OFFER: '2026-11-13',
} as const;

export type LegalDocName = keyof typeof LEGAL_VERSIONS;

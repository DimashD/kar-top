// Ссылки на приложение. Пока только Android (Google Play); iOS не выпускаем.
// Основной способ — браузер; приложение опционально.
export const ANDROID_URL =
  process.env.NEXT_PUBLIC_ANDROID_APP_URL || 'https://play.google.com/store/apps/details?id=kz.kartop.app';
// Схема диплинка в приложение (открыть конкретный заказ, если приложение установлено).
export const APP_SCHEME = process.env.NEXT_PUBLIC_APP_SCHEME || 'kartop';

export type Platform = 'ios' | 'android' | 'other';

export function detectPlatform(ua: string): Platform {
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

/** Страница открыта внутри приложения Kartop (у приложения есть канал KartopApp). */
export function inKartopApp(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).KartopApp !== 'undefined';
}

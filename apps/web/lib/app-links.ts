// Ссылки на магазины приложений. Задаются через окружение при публикации приложения;
// пока — плейсхолдеры (заменить на реальные ID после релиза в App Store / Google Play).
export const IOS_URL =
  process.env.NEXT_PUBLIC_IOS_APP_URL || 'https://apps.apple.com/kz/app/kartop/id000000000';
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

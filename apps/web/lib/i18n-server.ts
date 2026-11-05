import { cookies, headers } from 'next/headers';
import { dict, Dict, Lang, LANG_COOKIE, pickLang } from './i18n';

/** Язык текущего запроса (для серверных компонентов и generateMetadata). */
export function getLang(): Lang {
  return pickLang(cookies().get(LANG_COOKIE)?.value, headers().get('accept-language'));
}

export function getDict(): Dict {
  return dict(getLang());
}

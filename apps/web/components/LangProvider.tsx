'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { dict, Dict, Lang, LANGS, LANG_COOKIE, LANG_LABELS } from '../lib/i18n';

const LangContext = createContext<Lang>('ru');

/** Язык приходит с сервера (cookie / Accept-Language) — клиентские компоненты берут его отсюда. */
export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useT(): Dict {
  return dict(useLang());
}

/** Переключатель языка: сохраняет выбор в cookie на год и перерисовывает страницу. */
export function LangSwitcher() {
  const lang = useLang();
  const router = useRouter();

  function choose(l: Lang) {
    if (l === lang) return;
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div role="group" aria-label={dict(lang).language} style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
      {LANGS.map((l) => (
        <button key={l} type="button" onClick={() => choose(l)} aria-pressed={l === lang}
          style={{
            border: 'none', padding: '6px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: l === lang ? 'var(--carrot)' : 'var(--card)', color: l === lang ? '#fff' : 'var(--ink-60)',
          }}>
          {LANG_LABELS[l]}
        </button>
      ))}
    </div>
  );
}

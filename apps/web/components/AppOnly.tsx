'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { inKartopApp } from '../lib/app-links';

/**
 * Показывает children только внутри приложения Kartop, в браузере — fallback.
 * Статус заказа отслеживается только в приложении (там же пуши); в браузере — приглашение в приложение.
 * До проверки (первый рендер) ничего не показываем, чтобы в приложении не мелькал баннер.
 */
export default function AppOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [inApp, setInApp] = useState<boolean | null>(null);
  useEffect(() => setInApp(inKartopApp()), []);
  if (inApp === null) return null;
  return <>{inApp ? children : fallback}</>;
}

/** true — внутри приложения Kartop, false — браузер, null — ещё не проверили (первый рендер). */
export function useInApp(): boolean | null {
  const [inApp, setInApp] = useState<boolean | null>(null);
  useEffect(() => setInApp(inKartopApp()), []);
  return inApp;
}

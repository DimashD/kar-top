'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Перезапрашивает страницу (серверные данные) каждые N секунд — статус заказа обновляется сам. */
export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

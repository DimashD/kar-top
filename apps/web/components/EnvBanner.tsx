'use client';
import { useEffect, useState } from 'react';

/**
 * Красная плашка «ТЕСТОВАЯ СРЕДА» на test.* (staging), чтобы не перепутать с продом.
 * Определяем по домену в браузере: один и тот же образ работает и на staging, и на проде.
 */
export function EnvBanner() {
  const [isTest, setIsTest] = useState(false);
  useEffect(() => {
    const h = window.location.hostname;
    setIsTest(h.startsWith('test.') || h.startsWith('staging.'));
  }, []);
  if (!isTest) return null;
  return (
    <div
      role="status"
      style={{
        position: 'sticky', top: 0, zIndex: 9999, background: '#C62828', color: '#fff',
        textAlign: 'center', font: '600 13px/1.4 system-ui, sans-serif', padding: '6px 12px',
      }}
    >
      ТЕСТОВАЯ СРЕДА — данные ненастоящие, заказы не исполняются. Код входа: 111111
    </div>
  );
}

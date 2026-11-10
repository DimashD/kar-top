// Типы react-dom (пакет @types/react-dom не подключён): нужен только createPortal — окна поверх всей страницы.
declare module 'react-dom' {
  import type { ReactNode, ReactPortal } from 'react';
  export function createPortal(children: ReactNode, container: Element | DocumentFragment, key?: string | null): ReactPortal;
}

import type { CSSProperties, ReactNode } from 'react';

/**
 * Единый набор линейных иконок (24×24, обводка currentColor) — вместо эмодзи,
 * которые на разных телефонах разного размера и стиля.
 */
const c = (cx: number, cy: number, r: number) => <circle cx={cx} cy={cy} r={r} />;
const P: Record<string, ReactNode> = {
  store: <path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v1a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0V9M5 12.5V20h14v-7.5M10 20v-5h4v5" />,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6M9 16h3" />,
  bell: <path d="M6 16v-5a6 6 0 0112 0v5l2 2H4l2-2zM10 20.5a2 2 0 004 0" />,
  user: <><path d="M4 21a8 8 0 0116 0" />{c(12, 8, 4)}</>,
  pin: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" />{c(12, 9.5, 2.5)}</>,
  chat: <path d="M4 5h16v11H9l-5 4V5zM8 9.5h8M8 12.5h5" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z" />,
  route: <path d="M3 11l18-8-8 18-2-8-8-2z" />,
  scooter: <><path d="M8.5 17h7M15 6h2.5L19 14.5M4 9h6v5H4zM10 14l2 3" />{c(6, 17, 2.5)}{c(18, 17, 2.5)}</>,
  car: <><path d="M4 16v-4l2-5h12l2 5v4M4 16h16M4 12h16M6.5 16v2.5M17.5 16v2.5" />{c(7.5, 14, 0.4)}{c(16.5, 14, 0.4)}</>,
  bag: <path d="M5 8h14l-1 13H6L5 8zM9 8V6a3 3 0 016 0v2" />,
  truck: <><path d="M2 5h11v11H2zM13 9h4.5l3.5 3.5V16h-8" />{c(6, 18, 2)}{c(17, 18, 2)}</>,
  basket: <path d="M3 10h18l-2 10H5L3 10zM8 10l3-6M16 10l-3-6M9 14v3M12 14v3M15 14v3" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checkCircle: <><path d="M8 12.5l3 3 5-6" />{c(12, 12, 9)}</>,
  thumb: <path d="M7 10v11H3V10h4zM7 10l4-7a2 2 0 012 2v4h5.5a2 2 0 012 2.3l-1.3 7A2 2 0 0117.2 21H7" />,
  package: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9" />,
  clock: <><path d="M12 7v5l3 2" />{c(12, 12, 9)}</>,
  zap: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  globe: <><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />{c(12, 12, 9)}</>,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  logout: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  alert: <path d="M12 3l10 18H2L12 3zM12 10v4M12 17.5v.01" />,
  card: <path d="M3 6h18v12H3zM3 10h18M7 15h3" />,
  cart: <><path d="M3 4h2l2.5 11h11L21 8H6.5" />{c(9, 19.5, 1.5)}{c(17, 19.5, 1.5)}</>,
  send: <path d="M21 4L3 11l6 2 2 6 3-4 5 4 2-15zM9 13l8-6" />,
  tenge: <><path d="M9 8h6M9 11h6M12 11v6" />{c(12, 12, 9)}</>,
  xCircle: <><path d="M9 9l6 6M15 9l-6 6" />{c(12, 12, 9)}</>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />,
  search: <>{c(11, 11, 7)}<path d="M20 20l-3.5-3.5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  heart: <path d="M12 20s-8-4.7-8-10.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5C20 15.3 12 20 12 20z" />,
};
export type IconName = keyof typeof P;

export default function Icon({ name, size = 20, stroke = 1.9, style }: { name: IconName; size?: number; stroke?: number; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" style={{ display: 'inline-block', flex: 'none', verticalAlign: '-0.2em', ...style }}>
      {P[name]}
    </svg>
  );
}

/** Иконка в цветном кружке/квадрате — для пунктов меню, способов доставки, уведомлений, пустых экранов. */
export function IconTile({ name, size = 40, bg = 'var(--carrot-50)', color = 'var(--carrot)', round = false }: { name: IconName; size?: number; bg?: string; color?: string; round?: boolean }) {
  return (
    <span style={{ width: size, height: size, borderRadius: round ? 999 : size * 0.3, background: bg, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Icon name={name} size={Math.round(size * 0.5)} />
    </span>
  );
}

import Link from 'next/link';

/** Значок Kartop — корзинка с фруктами (как иконка приложения). */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="10 16 80 80" aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
      <circle cx="36" cy="46" r="13" fill="#D9531E" />
      <circle cx="51" cy="43" r="12" fill="#E8893A" />
      <circle cx="62" cy="49" r="10.5" fill="#C0392B" />
      <path d="M50 20C42 24 41 35 46 41C52 36 53 27 50 20Z" fill="#3E7D53" />
      <path d="M47 40C55 31 66 30 72 34C64 41 55 42 47 40Z" fill="#4F8F60" />
      <rect x="18" y="52" width="64" height="10" rx="5" fill="#BF4413" />
      <path d="M21 62H79L75 86Q74 92 67 92H33Q26 92 25 86Z" fill="#D9531E" />
      <path d="M38 67L36.5 84M50 67V84M62 67L63.5 84" stroke="#EFA07C" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

/** Логотип: значок + «Kartop». href=null — без ссылки. */
export default function Logo({ size = 28, href = '/' }: { size?: number; href?: string | null }) {
  const body = (
    <>
      <LogoMark size={size * 1.15} />
      <span className="logo-word" style={{ fontWeight: 900, fontSize: size * 0.86, color: 'var(--carrot)', letterSpacing: '-0.02em', lineHeight: 1 }}>Kartop</span>
    </>
  );
  const style = { display: 'inline-flex', alignItems: 'center', gap: size * 0.22, textDecoration: 'none', flex: 'none' } as const;
  return href == null ? <span style={style} aria-label="Kartop">{body}</span> : <Link href={href} style={style} aria-label="Kartop">{body}</Link>;
}

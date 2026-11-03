'use client';

import { formatKzPhone } from '../lib/phone';

/** Поле ввода телефона с форматом +7 7XX XXX XX XX. value хранит отформатированную строку. */
export default function PhoneInput({
  value, onChange, style, placeholder = '+7 701 234 56 78',
}: {
  value: string;
  onChange: (formatted: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(formatKzPhone(e.target.value))}
      inputMode="tel"
      autoComplete="tel"
      maxLength={16}
      placeholder={placeholder}
      style={style}
    />
  );
}

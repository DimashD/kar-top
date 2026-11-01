// Красивые плейсхолдеры по категориям: пока нет фото товара — показываем
// тематичную «карточку категории» (иконка + мягкий градиент) и название товара.

export interface CatStyle { emoji: string; from: string; to: string; ink: string }

const DEFAULT: CatStyle = { emoji: '🧺', from: '#F1EAE4', to: '#E7DED6', ink: '#8A7E76' };

// Подбор по ключевым словам в названии категории (ru).
const RULES: { test: RegExp; style: CatStyle }[] = [
  { test: /овощ/i,            style: { emoji: '🥕', from: '#FBE8D8', to: '#F6D3B4', ink: '#B5621C' } },
  { test: /фрукт/i,           style: { emoji: '🍎', from: '#FCE4E1', to: '#F7C9C2', ink: '#C0392B' } },
  { test: /зелен|трав/i,      style: { emoji: '🌿', from: '#E5F1E4', to: '#CDE6C9', ink: '#3E7C4F' } },
  { test: /ягод/i,            style: { emoji: '🫐', from: '#EDE4F3', to: '#D9C7E8', ink: '#6B3FA0' } },
  { test: /сухофрукт/i,       style: { emoji: '🍇', from: '#F3E8D6', to: '#E7D1AE', ink: '#946A2E' } },
  { test: /орех|семеч/i,      style: { emoji: '🥜', from: '#F1E6D5', to: '#E2CBA6', ink: '#8A5A2B' } },
  { test: /мяс|говяд|баран/i, style: { emoji: '🥩', from: '#F7DEDE', to: '#EFC2C2', ink: '#9C2B2B' } },
  { test: /птиц|куриц/i,      style: { emoji: '🍗', from: '#F8E8D5', to: '#EED2AE', ink: '#A06A24' } },
  { test: /молоч|сыр/i,       style: { emoji: '🧀', from: '#FBF1D8', to: '#F3E1AE', ink: '#A8871F' } },
  { test: /салат|корейск/i,   style: { emoji: '🥗', from: '#E8F1DE', to: '#D2E6BD', ink: '#5A7C2F' } },
  { test: /солен|кваш/i,      style: { emoji: '🥬', from: '#E6F0E2', to: '#CDE4C6', ink: '#4F7C3E' } },
  { test: /бакале/i,          style: { emoji: '🌾', from: '#F4ECD9', to: '#E7D6B2', ink: '#917320' } },
  { test: /яйц/i,             style: { emoji: '🥚', from: '#FBF4E6', to: '#F2E6CC', ink: '#A88B46' } },
  { test: /лепёшк|лепешк|выпеч|хлеб/i, style: { emoji: '🥖', from: '#F5E9D5', to: '#E9D3AC', ink: '#9A6B2E' } },
];

export function categoryStyle(categoryRu: string): CatStyle {
  return RULES.find((r) => r.test.test(categoryRu))?.style ?? DEFAULT;
}

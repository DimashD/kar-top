// «Умный список»: покупатель пишет или говорит как в заметках —
// «картошка 3 кг, лук, помидоры килограмм» — и мы подбираем товары магазина с количеством.
// Работает без сервера: разбор текста и нечёткое сопоставление с каталогом витрины.
import type { CatalogProduct, I18nName } from './api';

/** Товар витрины + его подкатегория: сорта вроде «Фуджи» находятся по слову «яблоки». */
export type SearchProduct = CatalogProduct & { category?: I18nName };
import { isWeighted } from './format';

export interface ListMatch {
  /** Фрагмент, который сказал/написал покупатель. */
  typed: string;
  /** Подходящие товары, лучший — первый. Пусто — не нашли. */
  options: SearchProduct[];
  /** Количество: граммы для весовых, штуки для штучных (для первого варианта). */
  qty: number;
  /** Несколько равно подходящих товаров — стоит уточнить у покупателя. */
  ambiguous: boolean;
}

/** Нижний регистр, ё → е, без пунктуации. */
export function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}.,\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

// Разговорные названия → слово, которое встречается в каталоге.
const SYNONYMS: Record<string, string[]> = {
  картошка: ['картофель'], картошки: ['картофель'], картоха: ['картофель'], картоп: ['картофель'], potato: ['картофель'], potatoes: ['картофель'],
  помидор: ['помидор', 'томат'], помидоры: ['помидор', 'томат'], помидорки: ['помидор', 'томат'], қызанақ: ['помидор', 'томат'], tomato: ['помидор', 'томат'], tomatoes: ['помидор', 'томат'],
  морковка: ['морковь'], морковки: ['морковь'], сәбіз: ['морковь'], carrot: ['морковь'], carrots: ['морковь'],
  огурчики: ['огур'], огурцы: ['огур'], қияр: ['огур'], cucumber: ['огур'], cucumbers: ['огур'],
  лучок: ['лук'], пияз: ['лук'], onion: ['лук'], onions: ['лук'],
  яблочки: ['яблок'], алма: ['яблок'], apple: ['яблок'], apples: ['яблок'],
  курочка: ['куриц', 'кур'], курица: ['куриц', 'кур'], тауық: ['куриц', 'кур'], chicken: ['куриц', 'кур'],
  капустка: ['капуст'], cabbage: ['капуст'],
  banana: ['банан'], bananas: ['банан'], банан: ['банан'],
  зелень: ['укроп', 'петрушк', 'кинз', 'зелен'], greens: ['укроп', 'петрушк', 'кинз'],
};

// Числа словами (ru/kk/en).
const NUMBER_WORDS: Record<string, number> = {
  один: 1, одна: 1, одну: 1, одного: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  полтора: 1.5, полторы: 1.5, пол: 0.5, половина: 0.5, половину: 0.5,
  бір: 1, екі: 2, үш: 3, төрт: 4, бес: 5, алты: 6, жеті: 7, сегіз: 8, тоғыз: 9, он: 10, жарты: 0.5,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5,
};

type Unit = 'kg' | 'g' | 'pcs';
const UNIT_WORDS: Record<string, Unit> = {
  кг: 'kg', кило: 'kg', килограмм: 'kg', килограмма: 'kg', килограммов: 'kg', kg: 'kg', kilo: 'kg', kilos: 'kg', келі: 'kg',
  г: 'g', гр: 'g', грамм: 'g', грамма: 'g', граммов: 'g', g: 'g', gram: 'g', grams: 'g', грам: 'g',
  шт: 'pcs', штук: 'pcs', штука: 'pcs', штуки: 'pcs', штучки: 'pcs', pcs: 'pcs', piece: 'pcs', pieces: 'pcs', дана: 'pcs',
  пучок: 'pcs', пучка: 'pcs', пучков: 'pcs', байлам: 'pcs', пачка: 'pcs', пачки: 'pcs', пачек: 'pcs', упаковка: 'pcs', упаковки: 'pcs',
};
// Слова-связки, которые не несут смысла.
const FILLER = new Set(['и', 'еще', 'ещё', 'пожалуйста', 'нужно', 'надо', 'хочу', 'мне', 'по', 'and', 'please', 'also', 'және', 'тағы']);

/** Похожесть двух слов: общий префикс или одна опечатка. */
function wordMatches(token: string, word: string): boolean {
  if (token.length < 2 || word.length < 2) return token === word;
  const p = Math.min(token.length, word.length, 5);
  if (token.slice(0, p) === word.slice(0, p) && (p >= 4 || token === word || word.startsWith(token))) return true;
  if (token.length >= 5 && word.length >= 5) return levenshtein(token.slice(0, 6), word.slice(0, 6)) <= 1;
  return false;
}

function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/** Слова названия на всех языках. */
function wordsOf(n?: I18nName): string[] {
  if (!n) return [];
  return [...new Set(norm([n.ru, n.kk, n.en].filter(Boolean).join(' ')).split(' ').filter((w) => w.length > 1))];
}

/** Оценка совпадения фразы с товаром: доля слов фразы, нашедших пару в названии. 0 — не подходит. */
function score(tokens: string[], p: SearchProduct): number {
  const words = wordsOf(p.name);
  const cat = wordsOf(p.category);
  let hit = 0;
  let nameHit = 0;
  for (const t of tokens) {
    const variants = SYNONYMS[t] ?? [t];
    if (variants.some((v) => words.some((w) => wordMatches(v, w)))) { hit++; nameHit++; }
    else if (variants.some((v) => cat.some((w) => wordMatches(v, w)))) hit++;
  }
  if (!hit) return 0;
  // «помидоры» — это свежие, а не «Помидоры солёные»: заготовки ниже, если о них не просили.
  const preserved = /солён|солен|маринован|квашен|по-корейски|сушён|вялен/;
  const penalty = preserved.test(norm(p.name.ru)) && !tokens.some((t) => preserved.test(t)) ? 0.05 : 0;
  // Чем полнее совпала фраза, тем выше; совпадение в названии чуть важнее, чем в подкатегории.
  return hit / tokens.length + 0.02 * (nameHit / tokens.length) + 0.01 / Math.max(1, words.length) - penalty;
}

/** Найти товары по фразе (для поиска и списка). Лучшие — первыми. */
export function findProducts(phrase: string, products: SearchProduct[], minScore = 0.5): SearchProduct[] {
  const tokens = norm(phrase).split(' ').filter((t) => t && !FILLER.has(t));
  if (!tokens.length) return [];
  return products
    .map((p) => ({ p, s: score(tokens, p) }))
    .filter((x) => x.s >= minScore)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
}

function parseNumber(t: string): number | null {
  if (/^\d+([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.'));
  return NUMBER_WORDS[t] ?? null;
}

/** Количество для товара из числа и единицы. Весовые — граммы, штучные — штуки. */
function toQty(p: CatalogProduct, n: number | null, unit: Unit | null): number {
  if (isWeighted(p.unit)) {
    if (unit === 'g') return Math.round(n ?? 500);
    if (unit === 'pcs' && p.avgPieceG) return Math.round((n ?? 1) * p.avgPieceG);
    if (unit === 'kg') return Math.round((n ?? 1) * 1000);
    if (n == null) return 1000;
    return n >= 50 ? Math.round(n) : Math.round(n * 1000); // «500» — граммы, «2» — килограммы
  }
  return Math.max(1, Math.round(n ?? 1));
}

/**
 * Разбор списка. Строки, запятые и «;» разделяют позиции явно; в речи без пауз
 * («помидоры килограмм картошка три кило лук») позиции разделяются количеством:
 * после числа/единицы следующее слово-товар начинает новую позицию.
 */
export function parseList(text: string, products: SearchProduct[]): ListMatch[] {
  const chunks = text.split(/[\n;,]+/).map((c) => c.trim()).filter(Boolean);
  const segments: { words: string[]; raw: string[]; n: number | null; unit: Unit | null }[] = [];
  for (const chunk of chunks) {
    let cur = { words: [] as string[], raw: [] as string[], n: null as number | null, unit: null as Unit | null };
    // Количество, сказанное до товара («2 кг помидоров»), и его исходные слова.
    let pending: { n: number | null; unit: Unit | null; raw: string[] } = { n: null, unit: null, raw: [] };
    const push = () => { if (cur.words.length) segments.push(cur); };
    for (const raw of norm(chunk).split(' ')) {
      if (!raw || FILLER.has(raw)) continue;
      // «полкило», «2кг», «500г»
      const m = raw.match(/^(\d+(?:[.,]\d+)?|пол)(кг|кило|г|гр|шт)$/);
      const tokens = m ? [m[1], m[2]] : [raw];
      for (const t of tokens) {
        const n = parseNumber(t);
        const u = UNIT_WORDS[t] ?? null;
        // Количество относится к текущей позиции, если у неё его ещё нет («картошка три кило»),
        // иначе — к следующей («2 кг помидоров»).
        if (n != null) {
          if (cur.words.length && cur.n == null && cur.unit == null) { cur.n = n; cur.raw.push(t); }
          else { pending.n = n; pending.raw.push(t); }
          continue;
        }
        if (u) {
          if (pending.n != null) { pending.unit = u; pending.raw.push(t); }
          else if (cur.words.length && cur.unit == null) { cur.unit = u; cur.raw.push(t); }
          else { pending.unit = u; pending.raw.push(t); }
          continue;
        }
        if (cur.words.length && (cur.n != null || cur.unit != null)) {
          push();
          cur = { words: [], raw: [...pending.raw], n: pending.n, unit: pending.unit };
          pending = { n: null, unit: null, raw: [] };
        } else if (!cur.words.length) {
          cur.n = pending.n; cur.unit = pending.unit; cur.raw.push(...pending.raw);
          pending = { n: null, unit: null, raw: [] };
        }
        cur.words.push(t);
        cur.raw.push(t);
      }
    }
    push();
  }

  const out: ListMatch[] = [];
  for (const seg of segments) {
    // Несколько товаров подряд без количества («лук чеснок») — делим жадно: самая длинная фраза, которая находит товар.
    let i = 0;
    while (i < seg.words.length) {
      let best: { j: number; found: CatalogProduct[] } | null = null;
      for (let j = seg.words.length; j > i; j--) {
        // Несколько слов — только если совпали все («грецкий орех»); иначе «лимон помидоры» склеились бы.
        const found = findProducts(seg.words.slice(i, j).join(' '), products, j - i > 1 ? 0.99 : 0.5);
        if (found.length) { best = { j, found }; break; }
      }
      const j = best?.j ?? seg.words.length;
      const isLast = j === seg.words.length;
      // Как сказал покупатель: последняя часть сегмента — со своими словами количества.
      const typed = isLast && i === 0 ? seg.raw.join(' ') : seg.words.slice(i, j).join(' ') + (isLast ? ' ' + seg.raw.filter((r) => !seg.words.includes(r)).join(' ') : '');
      const options = (best?.found ?? []).slice(0, 4);
      const n = isLast ? seg.n : null;
      const unit = isLast ? seg.unit : null;
      const top = options[0];
      const ambiguous = options.length > 1 && score(seg.words.slice(i, j), options[1]) >= score(seg.words.slice(i, j), top) - 0.01;
      out.push({ typed: typed.trim(), options, qty: top ? toQty(top, n, unit) : 0, ambiguous });
      i = j;
    }
  }
  return out;
}

/** Пересчитать количество при выборе другого варианта товара. */
export function qtyFor(p: SearchProduct, m: ListMatch, prev: SearchProduct | undefined): number {
  if (!prev || isWeighted(p.unit) === isWeighted(prev.unit)) return m.qty;
  return isWeighted(p.unit) ? 1000 : 1;
}

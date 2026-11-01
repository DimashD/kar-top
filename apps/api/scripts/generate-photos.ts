/**
 * Генерация фото товаров по названию и запись в MasterProduct.media = { url }.
 * Провайдер-независимый: сейчас реализован OpenAI gpt-image-1; легко заменить на
 * Google Imagen / FLUX (fal.ai, Replicate) — см. функцию generate().
 *
 * Запуск:
 *   OPENAI_API_KEY=sk-... npx ts-node scripts/generate-photos.ts [--all] [--limit=20]
 *
 * По умолчанию генерит только для товаров без фото. --all перегенерит всё.
 * Картинки кладутся в apps/web/public/products/<id>.png и отдаются Next как /products/<id>.png.
 */
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();
const PUBLIC_DIR = join(__dirname, '../../web/public/products');

// Единый стиль каталога — чтобы все карточки выглядели как одна витрина.
function promptFor(nameRu: string): string {
  return [
    `professional e-commerce product photography of ${nameRu} (fresh grocery / bazaar product)`,
    'on a clean light neutral background, soft natural daylight, slight top-down 45° angle',
    'high detail, appetizing, realistic, centered, square composition',
    'no text, no watermark, no packaging labels',
  ].join(', ');
}

async function generate(nameRu: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY не задан');
  // OpenAI Images (gpt-image-1). Для FLUX/Imagen — заменить этот блок на вызов их API.
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: promptFor(nameRu), size: '1024x1024', n: 1 }),
  });
  if (!r.ok) throw new Error(`image API ${r.status}: ${await r.text()}`);
  const data = (await r.json()) as { data: { b64_json?: string; url?: string }[] };
  const item = data.data[0];
  if (item.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error('пустой ответ image API');
}

async function main() {
  const all = process.argv.includes('--all');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 1000;

  await mkdir(PUBLIC_DIR, { recursive: true });
  const products = await prisma.masterProduct.findMany({ select: { id: true, name: true, media: true } });
  const todo = products.filter((p) => all || !(p.media as any)?.url).slice(0, limit);
  console.log(`К генерации: ${todo.length} из ${products.length}`);

  let ok = 0;
  for (const p of todo) {
    const nameRu = (p.name as any)?.ru ?? p.id;
    try {
      const img = await generate(nameRu);
      await writeFile(join(PUBLIC_DIR, `${p.id}.png`), img);
      await prisma.masterProduct.update({ where: { id: p.id }, data: { media: { url: `/products/${p.id}.png` } } });
      console.log(`✓ ${nameRu}`);
      ok++;
    } catch (e) {
      console.error(`✗ ${nameRu}: ${(e as Error).message}`);
    }
  }
  console.log(`Готово: ${ok}/${todo.length}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });

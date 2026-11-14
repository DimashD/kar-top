import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Лимит на фото реального товара (клиент уменьшает снимок до ~1600 px, это обычно < 1 МБ). */
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Шаблон для Gemini: по фото РЕАЛЬНОГО товара нарисовать карточку в едином стиле каталога.
 * {name} — название товара, {note} — уточнение сотрудника (необязательно).
 * Можно переопределить переменной окружения GEMINI_PHOTO_PROMPT (с теми же {name} и {note}).
 */
export const DEFAULT_PHOTO_PROMPT = [
  'The attached photo shows the REAL product "{name}" that our shop sells. Use it as the exact reference.',
  'Recreate THIS product as a professional e-commerce catalog photo:',
  'pure white seamless background, soft diffused studio light, a gentle natural shadow under the product,',
  'product centered and filling about 70% of a square frame, slight top-down angle, sharp focus, realistic and appetizing.',
  'Keep it faithful to the reference: same variety, colour, shape, size, surface texture, ripeness and packaging (if any).',
  'Do not add other products, props, plates, hands, text, labels or watermarks.',
  '{note}',
].join(' ');

export function buildPhotoPrompt(template: string, name: string, note?: string | null): string {
  const n = (note ?? '').trim();
  return template
    .replace(/\{name\}/g, name)
    .replace(/\{note\}/g, n ? `Additional instructions: ${n}.` : '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Фото товара: фото реального товара → генерация карточки в Gemini → проверка → публикация на витринах. */
@Injectable()
export class ProductPhotoService {
  private readonly log = new Logger(ProductPhotoService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Состояние фото товара для админки (без самих байтов). */
  async status(id: string) {
    const p = await this.prisma.masterProduct.findUnique({
      where: { id },
      select: { sourcePhotoAt: true, photoAt: true, media: true, photoDraftType: true },
    });
    if (!p) throw new NotFoundException('Товар не найден');
    return {
      hasSource: !!p.sourcePhotoAt,
      sourceVersion: p.sourcePhotoAt?.getTime() ?? null,
      hasDraft: !!p.photoDraftType,
      photoUrl: (p.media as any)?.url ?? null,
      generatorReady: !!process.env.GEMINI_API_KEY,
    };
  }

  /** Сохранить фото реального товара (base64 без префикса data:). null — удалить. */
  async setSource(id: string, data: string | null | undefined, type?: string) {
    await this.must(id);
    const buf = data ? Buffer.from(data, 'base64') : null;
    if (buf && buf.length > MAX_SOURCE_BYTES) throw new BadRequestException('Фото больше 2 МБ');
    if (buf && type && !IMAGE_TYPES.includes(type)) throw new BadRequestException('Формат фото: JPEG, PNG или WebP');
    await this.prisma.masterProduct.update({
      where: { id },
      data: { sourcePhoto: buf, sourcePhotoType: buf ? type ?? 'image/jpeg' : null, sourcePhotoAt: buf ? new Date() : null },
    });
    return this.status(id);
  }

  async source(id: string) {
    const p = await this.prisma.masterProduct.findUnique({ where: { id }, select: { sourcePhoto: true, sourcePhotoType: true } });
    if (!p?.sourcePhoto) throw new NotFoundException('Фото реального товара нет');
    return { data: Buffer.from(p.sourcePhoto), type: p.sourcePhotoType ?? 'image/jpeg' };
  }

  async draft(id: string) {
    const p = await this.prisma.masterProduct.findUnique({ where: { id }, select: { photoDraft: true, photoDraftType: true } });
    if (!p?.photoDraft) throw new NotFoundException('Черновика нет');
    return { data: Buffer.from(p.photoDraft), type: p.photoDraftType ?? 'image/png' };
  }

  /** Публичная картинка товара (сохранённая карточка) — для витрин. */
  async photo(id: string) {
    const p = await this.prisma.masterProduct.findUnique({ where: { id }, select: { photo: true, photoType: true } });
    if (!p?.photo) throw new NotFoundException('Фото нет');
    return { data: Buffer.from(p.photo), type: p.photoType ?? 'image/png' };
  }

  /**
   * Сгенерировать карточку по фото реального товара и шаблону. Результат — черновик:
   * на витринах он появится только после «Сохранить» (apply).
   */
  async generate(id: string, note?: string | null) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ServiceUnavailableException('Генерация не настроена: на сервере нет ключа GEMINI_API_KEY');
    const p = await this.prisma.masterProduct.findUnique({
      where: { id },
      select: { name: true, sourcePhoto: true, sourcePhotoType: true },
    });
    if (!p) throw new NotFoundException('Товар не найден');
    if (!p.sourcePhoto) throw new BadRequestException('Сначала прикрепите фото реального товара');
    const name = (p.name as any)?.ru ?? '';
    const prompt = buildPhotoPrompt(process.env.GEMINI_PHOTO_PROMPT || DEFAULT_PHOTO_PROMPT, name, note);
    const img = await this.callGemini(key, prompt, Buffer.from(p.sourcePhoto), p.sourcePhotoType ?? 'image/jpeg');
    await this.prisma.masterProduct.update({ where: { id }, data: { photoDraft: img.data, photoDraftType: img.type } });
    return this.status(id);
  }

  /** Черновик → фото товара на витринах (media.url указывает на наш эндпоинт, версия — против кэша). */
  async apply(id: string) {
    const p = await this.prisma.masterProduct.findUnique({ where: { id }, select: { photoDraft: true, photoDraftType: true } });
    if (!p) throw new NotFoundException('Товар не найден');
    if (!p.photoDraft) throw new BadRequestException('Нет сгенерированного фото');
    const at = new Date();
    await this.prisma.masterProduct.update({
      where: { id },
      data: {
        photo: p.photoDraft, photoType: p.photoDraftType ?? 'image/png', photoAt: at,
        photoDraft: null, photoDraftType: null,
        media: { url: `/api/catalog/products/${id}/photo?v=${at.getTime()}` },
      },
    });
    return this.status(id);
  }

  /** Gemini API (generateContent): текст-шаблон + фото реального товара → картинка. */
  private async callGemini(key: string, prompt: string, image: Buffer, mime: string): Promise<{ data: Buffer; type: string }> {
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: image.toString('base64') } }] }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
      }),
    }).catch((e) => { throw new ServiceUnavailableException(`Gemini недоступен: ${(e as Error).message}`); });
    const text = await r.text();
    if (!r.ok) {
      this.log.warn(`Gemini ${r.status}: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException(`Gemini вернул ошибку ${r.status}. Попробуйте ещё раз.`);
    }
    const parts: any[] = JSON.parse(text)?.candidates?.[0]?.content?.parts ?? [];
    const out = parts.find((x) => x.inlineData?.data || x.inline_data?.data);
    const d = out?.inlineData ?? out?.inline_data;
    if (!d?.data) throw new ServiceUnavailableException('Gemini не вернул картинку — попробуйте ещё раз или уточните описание');
    return { data: Buffer.from(d.data, 'base64'), type: d.mimeType ?? d.mime_type ?? 'image/png' };
  }

  private async must(id: string) {
    const p = await this.prisma.masterProduct.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw new NotFoundException('Товар не найден');
  }
}

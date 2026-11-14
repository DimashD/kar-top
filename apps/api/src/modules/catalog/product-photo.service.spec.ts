import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { buildPhotoPrompt, DEFAULT_PHOTO_PROMPT, ProductPhotoService } from './product-photo.service';

// Товар в «памяти»: prisma.masterProduct.findUnique/update по одному id.
function make(initial: Record<string, any> = {}) {
  const row: Record<string, any> = { id: 'p1', name: { ru: 'Грейпфрут' }, media: null, ...initial };
  const pick = (select: Record<string, boolean>) => Object.fromEntries(Object.keys(select).map((k) => [k, row[k] ?? null]));
  const prisma = {
    masterProduct: {
      findUnique: jest.fn(async ({ where, select }: any) => (where.id === row.id ? pick(select) : null)),
      update: jest.fn(async ({ data }: any) => { Object.assign(row, data); return row; }),
    },
  };
  return { svc: new ProductPhotoService(prisma as any), row };
}

const png = Buffer.from('fake-png-bytes');
function geminiReturns(body: any, ok = true, status = 200) {
  return jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok, status, text: async () => JSON.stringify(body) } as any);
}

describe('ProductPhotoService', () => {
  const env = process.env;
  beforeEach(() => { process.env = { ...env, GEMINI_API_KEY: 'test-key' }; });
  afterEach(() => { process.env = env; jest.restoreAllMocks(); });

  it('шаблон: подставляет название и уточнение', () => {
    const p = buildPhotoPrompt(DEFAULT_PHOTO_PROMPT, 'Яблоко Апорт', '3 штуки, без упаковки');
    expect(p).toContain('"Яблоко Апорт"');
    expect(p).toContain('Additional instructions: 3 штуки, без упаковки.');
    expect(buildPhotoPrompt(DEFAULT_PHOTO_PROMPT, 'Лимон', '')).not.toContain('Additional instructions');
  });

  it('фото реального товара сохраняется; больше 2 МБ — отказ', async () => {
    const { svc, row } = make();
    await svc.setSource('p1', Buffer.from('jpeg').toString('base64'), 'image/jpeg');
    expect(Buffer.from(row.sourcePhoto).toString()).toBe('jpeg');
    expect(row.sourcePhotoType).toBe('image/jpeg');
    const big = Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64');
    await expect(svc.setSource('p1', big, 'image/jpeg')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('без фото реального товара генерация не запускается', async () => {
    const { svc } = make();
    const f = jest.spyOn(global, 'fetch' as any);
    await expect(svc.generate('p1')).rejects.toBeInstanceOf(BadRequestException);
    expect(f).not.toHaveBeenCalled();
  });

  it('без ключа GEMINI_API_KEY — понятная ошибка 503', async () => {
    delete process.env.GEMINI_API_KEY;
    const { svc } = make({ sourcePhoto: Buffer.from('jpeg'), sourcePhotoType: 'image/jpeg' });
    await expect(svc.generate('p1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('генерация: в Gemini уходят шаблон с названием и само фото; ответ — в черновик, на витрине ещё нет', async () => {
    const { svc, row } = make({ sourcePhoto: Buffer.from('real-photo'), sourcePhotoType: 'image/jpeg' });
    const f = geminiReturns({ candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] });
    await svc.generate('p1', 'целый фрукт');
    const [url, init] = f.mock.calls[0] as any[];
    expect(url).toContain(':generateContent');
    expect(init.headers['x-goog-api-key']).toBe('test-key');
    const sent = JSON.parse(init.body);
    expect(sent.contents[0].parts[0].text).toContain('"Грейпфрут"');
    expect(sent.contents[0].parts[0].text).toContain('целый фрукт');
    expect(sent.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: Buffer.from('real-photo').toString('base64') });
    expect(Buffer.from(row.photoDraft).toString()).toBe('fake-png-bytes');
    expect(row.media).toBeNull();
  });

  it('Gemini без картинки в ответе — ошибка, черновик не трогаем', async () => {
    const { svc, row } = make({ sourcePhoto: Buffer.from('x'), sourcePhotoType: 'image/jpeg' });
    geminiReturns({ candidates: [{ content: { parts: [{ text: 'cannot' }] } }] });
    await expect(svc.generate('p1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(row.photoDraft).toBeUndefined();
  });

  it('сохранить: черновик становится фото товара, media.url — наш эндпоинт с версией', async () => {
    const { svc, row } = make({ photoDraft: png, photoDraftType: 'image/png' });
    await svc.apply('p1');
    expect(Buffer.from(row.photo).toString()).toBe('fake-png-bytes');
    expect(row.photoDraft).toBeNull();
    expect(row.media.url).toMatch(/^\/api\/catalog\/products\/p1\/photo\?v=\d+$/);
  });
});

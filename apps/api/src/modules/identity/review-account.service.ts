import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/** Демо-магазин для проверяющих Google Play: в общем списке не показывается. */
export const REVIEW_STORE_SLUG = 'kartop-demo';
const DEMO_PRODUCTS = 20;

/**
 * Аккаунт проверки Google Play: если задан REVIEW_PHONE, при старте API у этого номера есть
 * демо-магазин (владелец) с несколькими товарами — проверяющий входит в приложение магазина и видит его работу.
 */
@Injectable()
export class ReviewAccountService implements OnApplicationBootstrap {
  private readonly log = new Logger(ReviewAccountService.name);

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async onApplicationBootstrap() {
    const digits = (this.config.get<string>('REVIEW_PHONE') || '').replace(/\D/g, '');
    if (!/^77\d{9}$/.test(digits)) return;
    try {
      await this.ensure(`+${digits}`);
    } catch (e) {
      this.log.warn(`Демо-магазин для проверки не создан: ${(e as Error).message}`);
    }
  }

  private async ensure(phone: string) {
    const user = await this.prisma.user.upsert({ where: { phone }, update: {}, create: { phone, name: 'Google Play Review' } });
    const store = await this.prisma.store.upsert({
      where: { slug: REVIEW_STORE_SLUG },
      update: {},
      create: {
        slug: REVIEW_STORE_SLUG,
        name: 'Демо-магазин Kartop',
        status: 'ACTIVE',
        address: 'Алматы, демо-адрес',
        geom: { type: 'Point', coordinates: [76.9286, 43.2389] },
        legalName: 'Демо-магазин (для проверки)',
      },
    });
    await this.prisma.storeMember.upsert({
      where: { storeId_userId: { storeId: store.id, userId: user.id } },
      update: {},
      create: { storeId: store.id, userId: user.id, role: 'OWNER' },
    });
    if (await this.prisma.storeProduct.count({ where: { storeId: store.id } })) return;
    const masters = await this.prisma.masterProduct.findMany({ select: { id: true }, take: DEMO_PRODUCTS, orderBy: { id: 'asc' } });
    await this.prisma.storeProduct.createMany({
      data: masters.map((m, i) => ({ storeId: store.id, masterProductId: m.id, priceTiyn: (300 + i * 50) * 100 })),
      skipDuplicates: true,
    });
    this.log.log(`Демо-магазин для проверки готов: ${masters.length} товаров`);
  }
}

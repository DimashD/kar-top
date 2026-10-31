import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

function periodOf(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Биллинг магазинов: ежемесячный авто-счёт на подписку через Kaspi Pay (docs/03 §13).
 * Это НЕ оплата заказа покупателем — это подписка магазина платформе.
 */
@Injectable()
export class BillingService {
  private readonly log = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Запускается планировщиком 1-го числа. Идемпотентно по (subscription, period). */
  async issueMonthlyInvoices(now = new Date()) {
    const period = periodOf(now);
    const subs = await this.prisma.subscription.findMany({
      where: { status: 'active' },
      select: { id: true, priceTiyn: true, storeId: true },
    });
    let created = 0;
    for (const sub of subs) {
      const exists = await this.prisma.invoice.findUnique({
        where: { subscriptionId_period: { subscriptionId: sub.id, period } },
      });
      if (exists) continue; // уже выставлен за этот месяц
      const kaspiInvoiceId = await this.createKaspiInvoice(sub.storeId, sub.priceTiyn, period);
      await this.prisma.invoice.create({
        data: {
          subscriptionId: sub.id,
          period,
          amountTiyn: sub.priceTiyn,
          status: 'ISSUED',
          kaspiInvoiceId,
          issuedAt: now,
        },
      });
      created++;
      // TODO: пуш/SMS магазину со ссылкой на оплату.
    }
    this.log.log(`Выставлено счетов за ${period}: ${created}`);
    return { period, created };
  }

  /** Отметить счёт оплаченным (из вебхука Kaspi). */
  async markPaidByKaspiId(kaspiInvoiceId: string) {
    const inv = await this.prisma.invoice.findFirst({ where: { kaspiInvoiceId } });
    if (!inv || inv.status === 'PAID') return { updated: false };
    await this.prisma.invoice.update({ where: { id: inv.id }, data: { status: 'PAID', paidAt: new Date() } });
    // TODO: при suspended-магазине — снять ограничение витрины.
    return { updated: true };
  }

  /** Создание счёта в Kaspi Pay. Заглушка до договора и доступа к API Kaspi Business. */
  private async createKaspiInvoice(storeId: string, amountTiyn: number, period: string): Promise<string> {
    const merchantId = this.config.get<string>('KASPI_MERCHANT_ID');
    if (!merchantId) {
      this.log.warn('KASPI_MERCHANT_ID не задан — счёт создан как заглушка (dev)');
      return `dev-${storeId}-${period}`;
    }
    // TODO: реальный вызов Kaspi Pay (Invoice/QR) с подписанным запросом.
    return `kaspi-${storeId}-${period}`;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, Interval } from '@nestjs/schedule';
import { NotificationDispatcher } from '../notifications/dispatcher.service';
import { OpeningReminders } from '../notifications/opening-reminders.service';
import { BillingService } from '../billing/billing.service';

/**
 * Фоновые задачи платформы.
 * Включается переменной SCHEDULER_ENABLED=1 (в тестах/CI оставляем выключенным,
 * чтобы прогоны были детерминированы и не было фоновых пушей).
 */
@Injectable()
export class SchedulerService {
  private readonly log = new Logger(SchedulerService.name);
  private readonly enabled: boolean;
  private readonly billingEnabled: boolean;
  private dispatchRunning = false;

  constructor(
    config: ConfigService,
    private readonly dispatcher: NotificationDispatcher,
    private readonly billing: BillingService,
    private readonly reminders: OpeningReminders,
  ) {
    this.enabled = config.get('SCHEDULER_ENABLED') === '1';
    // Счета за подписку — отдельным выключателем: включаем, когда начнём брать плату с магазинов.
    this.billingEnabled = config.get('BILLING_ENABLED') === '1';
    this.log.log(`Планировщик: ${this.enabled ? 'включён' : 'выключен (SCHEDULER_ENABLED!=1)'}`);
  }

  /** Диспетч outbox каждые 5 секунд. Защита от наложения прогонов. */
  @Interval('outbox-dispatch', 5000)
  async dispatchOutbox() {
    if (!this.enabled || this.dispatchRunning) return;
    this.dispatchRunning = true;
    try {
      const r = await this.dispatcher.process();
      if (r.processed > 0) this.log.log(`outbox: обработано ${r.processed}, пушей ${r.pushesSent}`);
    } catch (e) {
      this.log.error(`outbox-dispatch: ${(e as Error).message}`);
    } finally {
      this.dispatchRunning = false;
    }
  }

  /** Раз в минуту: магазинам за час и за 30 минут до открытия — «проверьте цены и наличие». */
  @Cron('* * * * *', { name: 'opening-reminders', timeZone: 'UTC' })
  async openingReminders() {
    if (!this.enabled) return;
    try {
      const n = await this.reminders.run();
      if (n) this.log.log(`напоминаний перед открытием: ${n}`);
    } catch (e) {
      this.log.error(`opening-reminders: ${(e as Error).message}`);
    }
  }

  /** Ежемесячные счёта на подписку — 1-го числа в 06:00 UTC (11:00 Алматы). */
  @Cron('0 6 1 * *', { name: 'monthly-invoices', timeZone: 'UTC' })
  async issueMonthlyInvoices() {
    if (!this.enabled || !this.billingEnabled) return;
    try {
      const r = await this.billing.issueMonthlyInvoices();
      this.log.log(`биллинг: выставлено счетов за ${r.period}: ${r.created}`);
    } catch (e) {
      this.log.error(`monthly-invoices: ${(e as Error).message}`);
    }
  }
}

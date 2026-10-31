import { Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { BillingService } from './billing.service';
import { Public } from '../../common/auth/public.decorator';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  /** Вебхук Kaspi Pay о статусе оплаты. Подпись запроса обязательно проверяется. */
  @Public()
  @Post('kaspi/webhook')
  async kaspiWebhook(@Headers('x-kaspi-signature') signature: string, @Body() body: { invoiceId: string; status: string }) {
    const secret = this.config.get<string>('KASPI_API_KEY');
    if (secret) {
      const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
      if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        throw new UnauthorizedException('Неверная подпись вебхука');
      }
    }
    if (body?.status === 'paid' && body.invoiceId) {
      return this.billing.markPaidByKaspiId(body.invoiceId);
    }
    return { ignored: true };
  }

  /** Ручной/плановый запуск выставления счетов (позже — из планировщика 1-го числа). */
  @Post('run-monthly')
  runMonthly() {
    return this.billing.issueMonthlyInvoices();
  }
}

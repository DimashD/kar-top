import { Module } from '@nestjs/common';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';

@Module({ controllers: [BillingController], providers: [BillingService] })
export class BillingModule {}

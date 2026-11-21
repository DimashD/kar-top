import { Module } from '@nestjs/common';
import { AdminApplicationsController, ContractController, OnboardingController } from './onboarding/onboarding.controller';
import { OnboardingService } from './onboarding/onboarding.service';
import { StoreAccess } from '../common/auth/store-access.service';
import { AdminGuard } from '../common/auth/admin.guard';
import { LegalModule } from './legal.module';

// Самостоятельная регистрация магазинов: заявка, фото документов, договор на бумаге, проверка платформой.
@Module({
  imports: [LegalModule],
  controllers: [OnboardingController, ContractController, AdminApplicationsController],
  providers: [OnboardingService, StoreAccess, AdminGuard],
})
export class OnboardingModule {}

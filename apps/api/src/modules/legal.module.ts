import { Module } from '@nestjs/common';
import { AdminLegalController, LegalController } from './legal/legal.controller';
import { LegalService } from './legal/legal.service';
import { StoreAccess } from '../common/auth/store-access.service';
import { AdminGuard } from '../common/auth/admin.guard';
import { IdentityModule } from './identity.module';

// Юридические документы: журнал согласий покупателей и сотрудников, оферта для магазинов.
@Module({
  imports: [IdentityModule],
  controllers: [LegalController, AdminLegalController],
  providers: [LegalService, StoreAccess, AdminGuard],
})
export class LegalModule {}

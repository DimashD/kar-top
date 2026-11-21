import { Module } from '@nestjs/common';
import { AdminTariffsController, TariffsController } from './tariffs/tariffs.controller';
import { TariffsService } from './tariffs/tariffs.service';
import { AdminGuard } from '../common/auth/admin.guard';

// Тарифы для магазинов — отдельная страница, на которую ссылается оферта.
@Module({
  controllers: [TariffsController, AdminTariffsController],
  providers: [TariffsService, AdminGuard],
})
export class TariffsModule {}

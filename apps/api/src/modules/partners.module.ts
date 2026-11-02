import { Module } from '@nestjs/common';
import { PartnersController } from './partners/partners.controller';
import { PartnersService } from './partners/partners.service';
import { AdminGuard } from '../common/auth/admin.guard';

@Module({
  controllers: [PartnersController],
  providers: [PartnersService, AdminGuard],
})
export class PartnersModule {}

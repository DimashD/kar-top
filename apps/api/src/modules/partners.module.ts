import { Module } from '@nestjs/common';
import { PartnersController } from './partners/partners.controller';
import { PartnersService } from './partners/partners.service';
import { FeedbackController } from './partners/feedback.controller';
import { StoreAccess } from '../common/auth/store-access.service';
import { AdminGuard } from '../common/auth/admin.guard';

@Module({
  controllers: [PartnersController, FeedbackController],
  providers: [PartnersService, AdminGuard, StoreAccess],
})
export class PartnersModule {}

import { Module } from '@nestjs/common';
import { StaffController } from './staff/staff.controller';
import { StaffService } from './staff/staff.service';
import { PlatformAdminGuard } from '../common/auth/platform-admin.guard';

@Module({
  controllers: [StaffController],
  providers: [StaffService, PlatformAdminGuard],
})
export class StaffModule {}

import { Module } from '@nestjs/common';
import { OtpController } from './identity/otp.controller';
import { OtpService } from './identity/otp.service';

@Module({ controllers: [OtpController], providers: [OtpService] })
export class IdentityModule {}

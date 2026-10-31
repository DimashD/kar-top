import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OtpController } from './identity/otp.controller';
import { OtpService } from './identity/otp.service';
import { AuthService } from './identity/auth.service';
import { TokenService } from './identity/token.service';
import { TelegramChannel } from './identity/channels/telegram.channel';
import { SmsChannel } from './identity/channels/sms.channel';
import { WhatsappChannel } from './identity/channels/whatsapp.channel';

@Module({
  imports: [JwtModule.register({})],
  controllers: [OtpController],
  providers: [OtpService, AuthService, TokenService, TelegramChannel, SmsChannel, WhatsappChannel],
})
export class IdentityModule {}

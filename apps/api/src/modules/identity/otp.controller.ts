import { Body, Controller, Post } from '@nestjs/common';
import { OtpRequestDto, OtpVerifyDto } from './dto';
import { OtpService } from './otp.service';
import { AuthService } from './auth.service';

@Controller('auth/otp')
export class OtpController {
  constructor(
    private readonly otp: OtpService,
    private readonly auth: AuthService,
  ) {}

  /** Ответ одинаков для любого номера — нельзя узнать, зарегистрирован ли он. */
  @Post('request')
  async request(@Body() dto: OtpRequestDto) {
    await this.otp.request(dto.phone, dto.channel ?? 'telegram');
    return { sent: true };
  }

  @Post('verify')
  async verify(@Body() dto: OtpVerifyDto) {
    return this.auth.confirm(dto.phone, dto.code, dto.deviceLabel);
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { OtpRequestDto, OtpVerifyDto, RefreshDto } from './dto';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { AuthService } from './auth.service';
import { Public } from '../../common/auth/public.decorator';

@Public()
@Controller('auth/otp')
export class OtpController {
  constructor(
    private readonly otp: OtpService,
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
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

  /** Продление входа без кода (refresh-токен живёт 30 дней, с ротацией). */
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.tokens.refresh(dto.refreshToken);
  }
}

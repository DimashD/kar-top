import { Body, Controller, Post, Req } from '@nestjs/common';
import { OtpRequestDto, OtpVerifyDto, RefreshDto } from './dto';
import { TokenService } from './token.service';
import { OtpService } from './otp.service';
import { AuthService } from './auth.service';
import { Public } from '../../common/auth/public.decorator';

/**
 * Адрес клиента за нашим прокси (Caddy). Берём ПОСЛЕДНИЙ адрес в X-Forwarded-For — его дописал Caddy;
 * первые значения клиент может подделать, чтобы обойти лимит по IP.
 */
export function clientIp(req: any): string | null {
  const xff = String(req?.headers?.['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return xff[xff.length - 1] || req?.ip || null;
}

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
  async request(@Body() dto: OtpRequestDto, @Req() req: any) {
    // channel — куда ушёл код: telegram | sms | whatsapp | email | test (тестовая среда) | null.
    const channel = await this.otp.request(dto.phone, dto.channel ?? 'telegram', clientIp(req));
    return { sent: true, channel };
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

import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString, Length } from 'class-validator';
import { OtpService } from './otp.service';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';

class EmailRequestDto {
  @IsEmail() email!: string;
}
class EmailVerifyDto {
  @IsString() @Length(6, 6) code!: string;
}

/**
 * Привязка email к аккаунту. Требует access-токен (телефон уже подтверждён).
 * Email привязывается ТОЛЬКО после подтверждения кода из письма — оба владения доказаны.
 */
@Controller('auth/email')
export class EmailController {
  constructor(private readonly otp: OtpService) {}

  @Post('request')
  async request(@Body() dto: EmailRequestDto, @CurrentUser() user: RequestUser) {
    await this.otp.requestEmailCode(user.userId, dto.email);
    return { sent: true };
  }

  @Post('verify')
  async verify(@Body() dto: EmailVerifyDto, @CurrentUser() user: RequestUser) {
    const email = await this.otp.verifyEmailCode(user.userId, dto.code);
    return { paired: true, email };
  }
}

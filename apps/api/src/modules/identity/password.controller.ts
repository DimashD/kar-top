import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';

class PasswordLoginDto {
  @IsString() @MinLength(10) phone!: string;
  @IsString() @MinLength(1) password!: string;
}

class SetPasswordDto {
  @IsString() @MinLength(6, { message: 'Пароль — не короче 6 символов' }) @MaxLength(100) password!: string;
}

/** Пароль магазина: вход по номеру и паролю, установка/смена пароля, профиль (есть ли пароль). */
@Controller()
export class PasswordController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('auth/password/login')
  login(@Body() dto: PasswordLoginDto) {
    return this.auth.loginMerchant(dto.phone, dto.password);
  }

  @Post('me/password')
  set(@Body() dto: SetPasswordDto, @CurrentUser() user: RequestUser) {
    return this.auth.setPassword(user.userId, dto.password);
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.profile(user.userId);
  }
}

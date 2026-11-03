import { Body, Controller, Post } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../../common/auth/public.decorator';

class StaffLoginDto {
  // login — телефон (+77...) или email.
  @IsString() @MinLength(5) login!: string;
  @IsString() @MinLength(1) password!: string;
}

/** Вход сотрудников платформы по паролю (без OTP). */
@Public()
@Controller('auth/staff')
export class StaffAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: StaffLoginDto) {
    return this.auth.loginStaff(dto.login, dto.password);
  }
}

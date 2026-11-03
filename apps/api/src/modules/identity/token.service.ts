import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Access — короткоживущий (15 мин), refresh — с ротацией (30 дней). */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Длинный access-токен для сотрудников админки (чтобы не вылетать каждые 15 мин). */
  async issueStaff(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, typ: 'access' },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: '7d' },
    );
  }

  async issue(userId: string): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, typ: 'access' },
      { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: '15m' },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, typ: 'refresh' },
      { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: '30d' },
    );
    return { accessToken, refreshToken };
  }
}

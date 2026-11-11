import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { Public } from '../../common/auth/public.decorator';
import { TelegramLoginService } from './telegram-login.service';

class PollDto {
  @IsString() @Length(10, 64) token!: string;
}

/** Вход через Telegram-бот: start → ссылка на бота, poll → токены, webhook — обновления от Telegram. */
@Public()
@Controller()
export class TelegramLoginController {
  constructor(private readonly tg: TelegramLoginService) {}

  @Post('auth/telegram/start')
  start() {
    return this.tg.start();
  }

  @Post('auth/telegram/poll')
  @HttpCode(200)
  poll(@Body() dto: PollDto) {
    return this.tg.poll(dto.token);
  }

  @Post('telegram/webhook')
  @HttpCode(200)
  async webhook(@Body() update: unknown, @Headers('x-telegram-bot-api-secret-token') secret?: string) {
    if (secret !== this.tg.webhookSecret()) throw new ForbiddenException();
    await this.tg.handle(update);
    return { ok: true };
  }
}

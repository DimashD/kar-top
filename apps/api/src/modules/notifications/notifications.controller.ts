import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDispatcher } from './dispatcher.service';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';
import { AdminGuard } from '../../common/auth/admin.guard';

class RegisterTokenDto {
  @IsIn(['android', 'ios', 'web']) platform!: 'android' | 'ios' | 'web';
  @IsString() token!: string;
  // Какое приложение регистрирует токен (по умолчанию — приложение магазина).
  @IsOptional() @IsIn(['merchant', 'customer']) app?: 'merchant' | 'customer';
}

@Controller()
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  /** Регистрация push-токена устройства (требует access-токен). */
  @Post('devices/push-token')
  async register(@Body() dto: RegisterTokenDto, @CurrentUser() user: RequestUser) {
    await this.prisma.pushToken.upsert({
      where: { token: dto.token },
      update: { userId: user.userId, platform: dto.platform, app: dto.app ?? 'merchant' },
      create: { userId: user.userId, platform: dto.platform, token: dto.token, app: dto.app ?? 'merchant' },
    });
    return { registered: true };
  }

  /** Выход на устройстве: токен больше не получает пуши этого пользователя. */
  @Post('devices/push-token/remove')
  async unregister(@Body() dto: { token?: string }, @CurrentUser() user: RequestUser) {
    if (dto?.token) await this.prisma.pushToken.deleteMany({ where: { token: dto.token, userId: user.userId } });
    return { removed: true };
  }

  /** Центр уведомлений: последние 50 и число непрочитанных. */
  @Get('me/notifications')
  async mine(@CurrentUser() user: RequestUser, @Query('app') app?: string) {
    const where = { userId: user.userId, app: app === 'customer' ? 'customer' : 'merchant' };
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return { unread, items };
  }

  /** Отметить все уведомления прочитанными (открыли центр уведомлений). */
  @Post('me/notifications/read')
  async readAll(@CurrentUser() user: RequestUser, @Query('app') app?: string) {
    await this.prisma.notification.updateMany({ where: { userId: user.userId, app: app === 'customer' ? 'customer' : 'merchant', readAt: null }, data: { readAt: new Date() } });
    return { unread: 0 };
  }

  /** Прогон диспетчера outbox (позже — из планировщика/воркера каждые N секунд). */
  @UseGuards(AdminGuard)
  @Post('internal/notifications/dispatch')
  dispatch() {
    return this.dispatcher.process();
  }
}

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsString } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDispatcher } from './dispatcher.service';
import { CurrentUser, RequestUser } from '../../common/auth/current-user.decorator';
import { AdminGuard } from '../../common/auth/admin.guard';

class RegisterTokenDto {
  @IsIn(['android', 'ios', 'web']) platform!: 'android' | 'ios' | 'web';
  @IsString() token!: string;
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
      update: { userId: user.userId, platform: dto.platform },
      create: { userId: user.userId, platform: dto.platform, token: dto.token },
    });
    return { registered: true };
  }

  /** Центр уведомлений: последние 50 и число непрочитанных. */
  @Get('me/notifications')
  async mine(@CurrentUser() user: RequestUser) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId: user.userId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.notification.count({ where: { userId: user.userId, readAt: null } }),
    ]);
    return { unread, items };
  }

  /** Отметить все уведомления прочитанными (открыли центр уведомлений). */
  @Post('me/notifications/read')
  async readAll(@CurrentUser() user: RequestUser) {
    await this.prisma.notification.updateMany({ where: { userId: user.userId, readAt: null }, data: { readAt: new Date() } });
    return { unread: 0 };
  }

  /** Прогон диспетчера outbox (позже — из планировщика/воркера каждые N секунд). */
  @UseGuards(AdminGuard)
  @Post('internal/notifications/dispatch')
  dispatch() {
    return this.dispatcher.process();
  }
}

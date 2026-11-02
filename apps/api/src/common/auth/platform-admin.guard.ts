import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Только PLATFORM_ADMIN (полный доступ). Строже AdminGuard — SUPPORT сюда не пускаем.
 *  Ставится ПОСЛЕ глобального JwtAuthGuard. Используется для управления сотрудниками. */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Нет доступа');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
    if (user?.platformRole !== 'PLATFORM_ADMIN') {
      throw new ForbiddenException('Требуется роль администратора платформы');
    }
    return true;
  }
}

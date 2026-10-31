import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Доступ только сотрудникам платформы (platformRole: PLATFORM_ADMIN / SUPPORT). Ставится ПОСЛЕ JwtAuthGuard. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.userId;
    if (!userId) throw new ForbiddenException('Нет доступа');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
    if (!user?.platformRole || !['PLATFORM_ADMIN', 'SUPPORT'].includes(user.platformRole)) {
      throw new ForbiddenException('Требуется роль сотрудника платформы');
    }
    return true;
  }
}

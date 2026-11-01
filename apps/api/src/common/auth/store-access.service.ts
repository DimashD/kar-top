import { Injectable, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Проверка членства пользователя в магазине (защита от IDOR).
 * Используется всеми merchant-эндпоинтами. При необходимости — с проверкой роли.
 */
@Injectable()
export class StoreAccess {
  constructor(private readonly prisma: PrismaService) {}

  async assertMember(storeId: string, userId: string, roles?: Role[]): Promise<Role> {
    const member = await this.prisma.storeMember.findUnique({
      where: { storeId_userId: { storeId, userId } },
      select: { role: true },
    });
    if (!member) throw new ForbiddenException('Нет доступа к этому магазину');
    if (roles && !roles.includes(member.role)) {
      throw new ForbiddenException('Недостаточно прав в магазине');
    }
    return member.role;
  }
}

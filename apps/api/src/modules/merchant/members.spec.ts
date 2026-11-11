import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MerchantService } from './merchant.service';

/** Мини-база в памяти: пользователи и членства одного магазина. */
function setup(myRole: string = 'OWNER') {
  const users = new Map<string, any>([['me', { id: 'me', phone: '+77010000001', name: 'Владелец', passwordHash: 'x' }]]);
  const members = new Map<string, any>([['me', { storeId: 's1', userId: 'me', role: myRole }]]);
  let seq = 0;
  const prisma: any = {
    user: {
      upsert: jest.fn(async ({ where, create }: any) => {
        const found = [...users.values()].find((u) => u.phone === where.phone);
        if (found) return found;
        const u = { id: `u${++seq}`, passwordHash: null, ...create };
        users.set(u.id, u);
        return u;
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(users.get(where.id), data)),
    },
    storeMember: {
      findUnique: jest.fn(async ({ where }: any) => members.get(where.storeId_userId.userId) ?? null),
      findMany: jest.fn(async () => [...members.values()].map((m) => ({ role: m.role, user: users.get(m.userId) }))),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const id = where.storeId_userId.userId;
        members.set(id, members.has(id) ? { ...members.get(id), ...update } : create);
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(members.get(where.storeId_userId.userId), data)),
      delete: jest.fn(async ({ where }: any) => members.delete(where.storeId_userId.userId)),
    },
  };
  // Проверка прав как в StoreAccess.assertMember.
  const access: any = {
    assertMember: jest.fn(async (_s: string, userId: string, roles?: string[]) => {
      const m = members.get(userId);
      if (!m) throw new ForbiddenException();
      if (roles && !roles.includes(m.role)) throw new ForbiddenException();
      return m.role;
    }),
  };
  return { svc: new MerchantService(prisma, access), members, users };
}

describe('Сотрудники магазина', () => {
  it('владелец выдаёт доступ по номеру (8 7xx → +77xx), сотрудник ещё не входил', async () => {
    const { svc } = setup();
    const list: any[] = await svc.addMember('s1', 'me', { phone: '8 701 555 00 11', name: 'Айгерим', role: 'PICKER' });
    const added = list.find((m) => m.phone === '+77015550011');
    expect(added).toMatchObject({ role: 'PICKER', name: 'Айгерим', active: false, you: false });
    expect(list[0]).toMatchObject({ role: 'OWNER', you: true }); // владелец первым
  });

  it('повторная выдача тому же номеру меняет роль, а не дублирует', async () => {
    const { svc } = setup();
    await svc.addMember('s1', 'me', { phone: '+77015550011', role: 'PICKER' });
    const list: any[] = await svc.addMember('s1', 'me', { phone: '+77015550011', role: 'MANAGER' });
    expect(list.filter((m) => m.phone === '+77015550011')).toHaveLength(1);
    expect(list.find((m) => m.phone === '+77015550011').role).toBe('MANAGER');
  });

  it('кривой номер — ошибка', async () => {
    const { svc } = setup();
    await expect(svc.addMember('s1', 'me', { phone: '12345', role: 'PICKER' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('владельца нельзя понизить или удалить', async () => {
    const { svc } = setup();
    await expect(svc.updateMember('s1', 'me', 'me', { role: 'PICKER' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.removeMember('s1', 'me', 'me')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('владелец меняет роль и забирает доступ', async () => {
    const { svc } = setup();
    const added: any[] = await svc.addMember('s1', 'me', { phone: '+77015550011', role: 'PICKER' });
    const id = added.find((m) => m.phone === '+77015550011').userId;
    expect((await svc.updateMember('s1', 'me', id, { role: 'COURIER' }) as any[]).find((m) => m.userId === id).role).toBe('COURIER');
    expect((await svc.removeMember('s1', 'me', id) as any[]).some((m) => m.userId === id)).toBe(false);
  });

  it('менеджер видит список, но не может выдавать доступ', async () => {
    const { svc } = setup('MANAGER');
    await expect(svc.members('s1', 'me')).resolves.toHaveLength(1);
    await expect(svc.addMember('s1', 'me', { phone: '+77015550011', role: 'PICKER' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('сборщик не видит список сотрудников', async () => {
    const { svc } = setup('PICKER');
    await expect(svc.members('s1', 'me')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

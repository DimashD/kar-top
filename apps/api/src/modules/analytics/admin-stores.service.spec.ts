import { BadRequestException } from '@nestjs/common';
import { AdminStoresService } from './admin-stores.service';

function prismaWithTx() {
  const tx = {
    user: { upsert: jest.fn().mockResolvedValue({ id: 'owner1' }) },
    store: {
      findUnique: jest.fn().mockResolvedValue(null), // slug свободен
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 's1', slug: data.slug, name: data.name, status: data.status })),
    },
  };
  return {
    tx,
    prisma: { $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)) },
  };
}

describe('AdminStoresService.provision (invite-only)', () => {
  it('создаёт магазин PENDING, владельца по телефону и роль OWNER', async () => {
    const { prisma, tx } = prismaWithTx();
    const svc = new AdminStoresService(prisma as any);
    const r: any = await svc.provision({ name: 'Зелёный дворик', ownerPhone: '+7 701 555 00 11', city: 'Алматы' });

    expect(r.status).toBe('PENDING');
    expect(r.owner.phone).toBe('+77015550011'); // нормализован
    expect(tx.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { phone: '+77015550011' } }));
    const createArg = (tx.store.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.status).toBe('PENDING');
    expect(createArg.data.members.create).toEqual({ userId: 'owner1', role: 'OWNER' });
    expect(createArg.data.slug).toMatch(/^zelenyy-dvorik-[a-z0-9]{4}$/); // транслит + суффикс
  });

  it('отклоняет кривой телефон владельца', async () => {
    const { prisma } = prismaWithTx();
    const svc = new AdminStoresService(prisma as any);
    await expect(svc.provision({ name: 'Магазин', ownerPhone: '12345' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('требует название', async () => {
    const { prisma } = prismaWithTx();
    const svc = new AdminStoresService(prisma as any);
    await expect(svc.provision({ name: 'A', ownerPhone: '+77015550011' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

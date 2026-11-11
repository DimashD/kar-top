import { NotificationDispatcher } from './dispatcher.service';

/**
 * Владелец двух магазинов получает пуши обоих; сотрудник — только своего магазина;
 * покупатель — только о своём заказе.
 */
describe('Кому уходят пуши о заказе', () => {
  const members: Record<string, { userId: string }[]> = {
    storeA: [{ userId: 'owner' }, { userId: 'pickerA' }],
    storeB: [{ userId: 'owner' }, { userId: 'managerB' }],
  };
  const orders: Record<string, { customerId: string; storeId: string }> = {
    o1: { customerId: 'buyer1', storeId: 'storeA' },
    o2: { customerId: 'buyer2', storeId: 'storeB' },
  };
  const prisma: any = {
    order: {
      findUnique: jest.fn(async ({ where }: any) => {
        const o = orders[where.id];
        return o ? { customerId: o.customerId, store: { members: members[o.storeId] } } : null;
      }),
    },
  };
  const svc = new NotificationDispatcher(prisma, {} as any, {} as any);
  const who = async (audience: string, orderId: string) =>
    ((await (svc as any).recipients(audience, 'order', orderId)) as { userId: string; role: string }[])
      .map((r) => `${r.userId}:${r.role}`).sort();

  it('новый заказ в магазине A — владельцу и сборщику A, но не менеджеру B', async () => {
    expect(await who('merchant', 'o1')).toEqual(['owner:merchant', 'pickerA:merchant']);
  });

  it('новый заказ в магазине B — владельцу и менеджеру B, но не сборщику A', async () => {
    expect(await who('merchant', 'o2')).toEqual(['managerB:merchant', 'owner:merchant']);
  });

  it('статус заказа — только его покупателю', async () => {
    expect(await who('customer', 'o1')).toEqual(['buyer1:customer']);
  });

  it('«both» — покупателю и всем сотрудникам этого магазина', async () => {
    expect(await who('both', 'o2')).toEqual(['buyer2:customer', 'managerB:merchant', 'owner:merchant']);
  });
});

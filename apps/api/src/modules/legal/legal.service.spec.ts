import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { LegalService } from './legal.service';
import { LEGAL_VERSIONS } from './legal-versions';

/** Мини-база в памяти: журнал согласий, один магазин и его члены. */
function setup(role = 'OWNER', codeOk = true) {
  const rows: any[] = [];
  const store: any = { id: 's1', legalName: null, legalBin: null };
  const prisma: any = {
    legalAcceptance: {
      findMany: jest.fn(async ({ where }: any) => rows.filter((r) => r.userId === where.userId && r.storeId == null && where.doc.in.includes(r.doc))),
      findFirst: jest.fn(async ({ where }: any) => [...rows].reverse().find((r) => r.storeId === where.storeId && r.doc === where.doc) ?? null),
      createMany: jest.fn(async ({ data }: any) => { data.forEach((d: any) => rows.push({ storeId: null, ...d })); }),
      create: jest.fn(async ({ data }: any) => { rows.push({ ...data, acceptedAt: new Date(), user: { phone: '+77010000001', name: null } }); }),
    },
    store: {
      findUnique: jest.fn(async () => store),
      update: jest.fn(async ({ data }: any) => Object.assign(store, data)),
    },
    user: { findUnique: jest.fn(async () => ({ phone: '+77010000001' })) },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };
  const access: any = {
    assertMember: jest.fn(async (_s: string, _u: string, roles?: string[]) => {
      if (roles && !roles.includes(role)) throw new ForbiddenException();
      return role;
    }),
  };
  const otp: any = { request: jest.fn(async () => 'test'), verify: jest.fn(async () => (codeOk ? '77010000001' : null)) };
  return { svc: new LegalService(prisma, access, otp), rows, store, otp };
}

describe('LegalService', () => {
  it('записывает согласия покупателя один раз на редакцию', async () => {
    const { svc, rows } = setup();
    const st = await svc.acceptMine('u1', ['TERMS', 'PD_CONSENT'], { ip: '1.2.3.4', userAgent: 'test' });
    expect(st).toMatchObject({ terms: true, pdConsent: true });
    await svc.acceptMine('u1', ['TERMS'], {});
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ doc: 'TERMS', version: LEGAL_VERSIONS.TERMS, method: 'CLICK', ip: '1.2.3.4' });
  });

  it('владелец принимает оферту кодом: реквизиты сохраняются у магазина', async () => {
    const { svc, store, rows } = setup('OWNER');
    const st = await svc.acceptOffer('s1', 'u1', ' ИП Иванов ', '123456789012', '111111', {});
    expect(st.accepted).toBe(true);
    expect(store).toMatchObject({ legalName: 'ИП Иванов', legalBin: '123456789012' });
    expect(rows[0]).toMatchObject({ doc: 'MERCHANT_OFFER', method: 'SMS', storeId: 's1' });
  });

  it('неверный код — оферта не принята', async () => {
    const { svc, rows } = setup('OWNER', false);
    await expect(svc.acceptOffer('s1', 'u1', 'ИП Иванов', '123456789012', '000000', {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(rows).toHaveLength(0);
  });

  it('менеджер не может принять оферту за владельца', async () => {
    const { svc } = setup('MANAGER');
    await expect(svc.acceptOffer('s1', 'u1', 'ИП Иванов', '123456789012', '111111', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('админ отмечает бумагу: без реквизитов нельзя, с реквизитами — запись с заметкой', async () => {
    const { svc, rows } = setup();
    await expect(svc.markOffer('s1', 'a1', 'PAPER', undefined, undefined, undefined, {})).rejects.toThrow('ИИН/БИН');
    const st = await svc.markOffer('s1', 'a1', 'PAPER', 'ТОО Ромашка', '987654321098', 'оригинал в папке', {});
    expect(st.last).toMatchObject({ method: 'PAPER', note: 'оригинал в папке' });
    expect(rows[0].meta).toMatchObject({ markedByAdmin: true });
  });
});

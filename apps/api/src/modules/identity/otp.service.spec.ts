import { BadRequestException } from '@nestjs/common';
import { OtpService } from './otp.service';

// Лёгкие моки для проверки правила: email привязывается только после подтверждения владения.
function make(overrides: any = {}) {
  const redis = {
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(300),
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const email = { name: 'email', send: jest.fn().mockResolvedValue(true) };
  const svc = new OtpService(redis as any, {} as any, prisma as any, {} as any, {} as any, {} as any, email as any);
  Object.assign(prisma.user, overrides.user ?? {});
  return { svc, redis, prisma, email };
}

describe('OtpService email pairing (владение подтверждается)', () => {
  it('отклоняет некорректный email', async () => {
    const { svc } = make();
    await expect(svc.requestEmailCode('u1', 'not-an-email')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отклоняет email, уже привязанный к другому аккаунту', async () => {
    const { svc, prisma } = make();
    prisma.user.findUnique.mockResolvedValue({ id: 'other' });
    await expect(svc.requestEmailCode('u1', 'taken@example.com')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('отправляет код на почту при валидном email (ещё не привязывая)', async () => {
    const { svc, email, prisma } = make();
    await svc.requestEmailCode('u1', 'ok@example.com');
    expect(email.send).toHaveBeenCalledWith('ok@example.com', expect.stringMatching(/^\d{6}$/));
    expect(prisma.user.update).not.toHaveBeenCalled(); // привязки ещё нет
  });

  it('verify без запрошенного кода → BadRequest, привязки нет', async () => {
    const { svc, prisma } = make();
    await expect(svc.verifyEmailCode('u1', '123456')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

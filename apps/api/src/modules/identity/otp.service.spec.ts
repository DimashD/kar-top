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

describe('OtpService тестовый OTP-код (только staging)', () => {
  function makeEnv(env: Record<string, string | undefined>) {
    const store: Record<string, string> = {};
    const redis = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      set: jest.fn(async (k: string, v: string) => { store[k] = v; return 'OK'; }),
      get: jest.fn(async (k: string) => store[k] ?? null),
      del: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(300),
    };
    const config = { get: jest.fn((k: string) => env[k]) };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const ch = () => ({ send: jest.fn().mockResolvedValue(true) });
    const tg = ch(), sms = ch(), wa = ch(), email = ch();
    const svc = new OtpService(redis as any, config as any, prisma as any, tg as any, sms as any, wa as any, email as any);
    return { svc, tg, sms, wa, email };
  }

  it('staging + TEST_OTP_CODE: код фиксированный, никуда не отправляется', async () => {
    const { svc, tg, sms } = makeEnv({ APP_ENV: 'staging', TEST_OTP_CODE: '111111' });
    await svc.request('+77011234567');
    expect(tg.send).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
    await expect(svc.verify('+77011234567', '111111')).resolves.toBe('77011234567');
  });

  it('production: TEST_OTP_CODE игнорируется, код уходит в канал', async () => {
    const { svc, tg } = makeEnv({ APP_ENV: 'production', TEST_OTP_CODE: '111111' });
    await svc.request('+77011234567');
    expect(tg.send).toHaveBeenCalledWith('+77011234567', expect.stringMatching(/^\d{6}$/));
    await expect(svc.verify('+77011234567', '111111')).resolves.toBeNull();
  });
});

import { BadRequestException } from '@nestjs/common';
import { OtpService } from './otp.service';
import { clientIp } from './otp.controller';

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

  it('staging: лимит запросов кода не применяется (SMS не тратятся)', async () => {
    const { svc } = makeEnv({ APP_ENV: 'staging', TEST_OTP_CODE: '111111' });
    for (let i = 0; i < 5; i++) await svc.request('+77011234567');
    await expect(svc.verify('+77011234567', '111111')).resolves.toBe('77011234567');
  });
});

/** Redis в памяти: incr / set (с NX) / get / del — достаточно, чтобы честно проверить лимиты. */
function memRedis() {
  const m = new Map<string, string>();
  return {
    m,
    incr: jest.fn(async (k: string) => { const n = Number(m.get(k) ?? 0) + 1; m.set(k, String(n)); return n; }),
    expire: jest.fn(async () => 1),
    set: jest.fn(async (k: string, v: string, ...args: any[]) => {
      if (args.includes('NX') && m.has(k)) return null;
      m.set(k, v); return 'OK';
    }),
    get: jest.fn(async (k: string) => m.get(k) ?? null),
    del: jest.fn(async (k: string) => (m.delete(k) ? 1 : 0)),
    ttl: jest.fn(async () => 300),
  };
}

describe('OtpService: защита от SMS-pumping (прод)', () => {
  function make(env: Record<string, string> = {}, pairedEmail: string | null = null) {
    const redis = memRedis();
    const config = { get: jest.fn((k: string) => ({ APP_ENV: 'production', ...env } as any)[k]) };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(pairedEmail ? { email: pairedEmail } : null) } };
    const ch = () => ({ send: jest.fn().mockResolvedValue(true) });
    const tg = ch(), sms = ch(), wa = ch(), email = ch();
    const svc = new OtpService(redis as any, config as any, prisma as any, tg as any, sms as any, wa as any, email as any);
    // «Прошла минута»: снять паузу между запросами на номер.
    const skipCooldown = () => { for (const k of [...redis.m.keys()]) if (k.startsWith('otp:cd:')) redis.m.delete(k); };
    return { svc, redis, tg, sms, wa, email, skipCooldown };
  }
  const phone = (i: number) => `+7701${String(1000000 + i)}`;

  it('повтор на тот же номер раньше чем через минуту → 429', async () => {
    const { svc, skipCooldown } = make();
    await svc.request('+77011234567', 'sms', '1.1.1.1');
    await expect(svc.request('+77011234567', 'sms', '1.1.1.1')).rejects.toMatchObject({ status: 429 });
    skipCooldown();
    await expect(svc.request('+77011234567', 'sms', '1.1.1.1')).resolves.toBe('sms');
  });

  it('номер: 4-й запрос за 15 минут → 429 (даже с паузами и с разных IP)', async () => {
    const { svc, skipCooldown } = make();
    for (let i = 0; i < 3; i++) { await svc.request('+77011234567', 'sms', `2.2.2.${i}`); skipCooldown(); }
    await expect(svc.request('+77011234567', 'sms', '2.2.2.9')).rejects.toMatchObject({ status: 429 });
  });

  it('IP: 11-й номер с одного адреса за час → 429; другой адрес работает', async () => {
    const { svc, sms } = make();
    for (let i = 0; i < 10; i++) await svc.request(phone(i), 'sms', '3.3.3.3');
    await expect(svc.request(phone(10), 'sms', '3.3.3.3')).rejects.toMatchObject({ status: 429 });
    expect(sms.send).toHaveBeenCalledTimes(10);
    await expect(svc.request(phone(11), 'sms', '4.4.4.4')).resolves.toBe('sms');
  });

  it('общий бюджет: после лимита платные каналы не вызываются, ответ 429', async () => {
    const { svc, sms, tg, wa } = make({ OTP_PAID_PER_HOUR: '3' });
    for (let i = 0; i < 3; i++) await svc.request(phone(i), 'sms', `5.5.5.${i}`);
    await expect(svc.request(phone(3), 'sms', '5.5.5.3')).rejects.toMatchObject({ status: 429 });
    expect(sms.send).toHaveBeenCalledTimes(3);
    expect(tg.send).not.toHaveBeenCalled();
    expect(wa.send).not.toHaveBeenCalled();
  });

  it('общий бюджет исчерпан, но email привязан → код уходит на почту (бесплатно)', async () => {
    const { svc, sms, email } = make({ OTP_PAID_PER_HOUR: '1' }, 'me@example.com');
    // Почта идёт первой и бюджет платных каналов не тратит.
    await expect(svc.request(phone(1), 'sms', '6.6.6.1')).resolves.toBe('email');
    await expect(svc.request(phone(2), 'sms', '6.6.6.2')).resolves.toBe('email');
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('clientIp: берёт адрес, дописанный нашим прокси (последний), а не подставленный клиентом', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.7' } })).toBe('203.0.113.7');
    expect(clientIp({ headers: { 'x-forwarded-for': '203.0.113.7' } })).toBe('203.0.113.7');
    expect(clientIp({ headers: {}, ip: '10.0.0.1' })).toBe('10.0.0.1');
  });
});

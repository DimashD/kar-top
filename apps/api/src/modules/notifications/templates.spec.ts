import { TEMPLATES } from './templates';

describe('шаблоны уведомлений', () => {
  it('новый заказ адресован магазину, громкий и критичный', () => {
    const t = TEMPLATES['order.placed'];
    expect(t.audience).toBe('merchant');
    expect(t.loud).toBe(true);
    expect(t.critical).toBe(true);
    expect(t.body({ number: 42 })).toContain('42');
  });

  it('статусы сборки/доставки адресованы покупателю', () => {
    for (const ev of ['order.accepted', 'order.substitution_needed', 'order.ready', 'order.delivering', 'order.delivered']) {
      expect(TEMPLATES[ev].audience).toBe('customer');
    }
  });

  it('биллинг адресован магазину', () => {
    expect(TEMPLATES['billing.invoice_issued'].audience).toBe('merchant');
    expect(TEMPLATES['billing.invoice_paid'].audience).toBe('merchant');
  });

  it('отмена — обеим сторонам', () => {
    expect(TEMPLATES['order.cancelled'].audience).toBe('both');
  });

  it('критичные события помечены для резервного SMS', () => {
    expect(TEMPLATES['order.accepted'].critical).toBe(true);
    expect(TEMPLATES['order.substitution_needed'].critical).toBe(true);
    expect(TEMPLATES['billing.invoice_issued'].critical).toBe(true);
    expect(TEMPLATES['order.ready'].critical).toBeFalsy();
  });

  it('тело счёта конвертирует тиыны в тенге', () => {
    expect(TEMPLATES['billing.invoice_issued'].body({ amountTiyn: 1490000, period: '2026-11' })).toContain('14900');
  });

  it('у всех шаблонов есть заголовок и тело-функция', () => {
    for (const [ev, t] of Object.entries(TEMPLATES)) {
      expect(typeof t.title).toBe('string');
      expect(t.title.length).toBeGreaterThan(0);
      expect(typeof t.body).toBe('function');
      expect(typeof t.body({})).toBe('string'); // не падает на пустом payload
      expect(['customer', 'merchant', 'both']).toContain(t.audience);
      void ev;
    }
  });
});

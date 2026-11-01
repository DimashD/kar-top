import { canTransition, piiVisibleToMerchant, ORDER_TRANSITIONS } from './order-state';

describe('order state machine', () => {
  it('разрешает прямые переходы по воронке', () => {
    expect(canTransition('PLACED', 'ACCEPTED')).toBe(true);
    expect(canTransition('ACCEPTED', 'PICKING')).toBe(true);
    expect(canTransition('PICKING', 'READY')).toBe(true);
    expect(canTransition('READY', 'DELIVERING')).toBe(true);
    expect(canTransition('DELIVERING', 'DELIVERED')).toBe(true);
    expect(canTransition('DELIVERED', 'COMPLETED')).toBe(true);
  });

  it('запрещает перескоки и откаты', () => {
    expect(canTransition('PLACED', 'DELIVERED')).toBe(false);
    expect(canTransition('ACCEPTED', 'PLACED')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED')).toBe(false); // доставленный не отменить
    expect(canTransition('COMPLETED', 'DELIVERING')).toBe(false);
  });

  it('отмена доступна из активных статусов, но не из финальных', () => {
    expect(canTransition('PLACED', 'CANCELLED')).toBe(true);
    expect(canTransition('PICKING', 'CANCELLED')).toBe(true);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'CANCELLED')).toBe(false);
  });

  it('финальные статусы — тупики', () => {
    expect(ORDER_TRANSITIONS.COMPLETED).toHaveLength(0);
    expect(ORDER_TRANSITIONS.CANCELLED).toHaveLength(0);
  });

  it('ПДн скрыты до ACCEPTED', () => {
    expect(piiVisibleToMerchant('CREATED')).toBe(false);
    expect(piiVisibleToMerchant('PLACED')).toBe(false);
    expect(piiVisibleToMerchant('ACCEPTED')).toBe(true);
    expect(piiVisibleToMerchant('DELIVERING')).toBe(true);
  });
});

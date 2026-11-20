import { checkBin } from './bin-check';

describe('checkBin', () => {
  it('принимает корректный БИН (Kaspi Bank)', () => {
    expect(checkBin('971240001315')).toEqual({ valid: true, kind: 'BIN' });
  });
  it('принимает корректный ИИН', () => {
    // 900101300017: контрольная цифра посчитана по алгоритму.
    expect(checkBin('900101300017').valid).toBe(true);
    expect(checkBin('900101300017').kind).toBe('IIN');
  });
  it('отклоняет неверную контрольную цифру', () => {
    expect(checkBin('971240001316').valid).toBe(false);
  });
  it('отклоняет не 12 цифр', () => {
    expect(checkBin('12345').valid).toBe(false);
    expect(checkBin('abcdefghijkl').valid).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { bagLotExceedsLimit, bagLotTextContract, countUtf16Units } from './text-field-contracts';

describe('inherited bag-lot text policy', () => {
  it.each([49, 50, 51])('counts and validates %i UTF-16 units without changing input', (length) => {
    const value = 'X'.repeat(length);
    expect(countUtf16Units(value)).toBe(length);
    expect(bagLotExceedsLimit(value)).toBe(length > bagLotTextContract.maxUtf16Units);
    expect(value).toBe('X'.repeat(length));
  });
  it.each([
    ['áñ', 2],
    ['漢字', 2],
    ['e\u0301', 2],
    ['😀', 2],
    ['\r\n', 2],
    ['  LOTE  ', 8],
  ])('uses the same untrimmed UTF-16 definition for %j', (value, units) => {
    expect(countUtf16Units(value)).toBe(units);
  });
});

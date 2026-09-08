import { isValidCategory, DATING_CATEGORIES } from '../src/lib/categories';

describe('isValidCategory', () => {
  it('accepts all 5 defined dating categories', () => {
    for (const category of DATING_CATEGORIES) {
      expect(isValidCategory(category)).toBe(true);
    }
  });

  it('rejects unknown strings', () => {
    expect(isValidCategory('UNKNOWN')).toBe(false);
    expect(isValidCategory('amical')).toBe(false); // case-sensitive
  });

  it('rejects non-string values', () => {
    expect(isValidCategory(undefined)).toBe(false);
    expect(isValidCategory(null)).toBe(false);
    expect(isValidCategory(42)).toBe(false);
  });
});

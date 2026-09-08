export const DATING_CATEGORIES = [
  'AMICAL',
  'AMOUREUX',
  'SANS_LENDEMAIN',
  'MARIAGE',
  'PROFESSIONNEL',
] as const;

export type DatingCategory = (typeof DATING_CATEGORIES)[number];

export function isValidCategory(value: unknown): value is DatingCategory {
  return typeof value === 'string' && (DATING_CATEGORIES as readonly string[]).includes(value);
}

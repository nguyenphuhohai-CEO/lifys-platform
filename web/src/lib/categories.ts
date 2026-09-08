export const DATING_CATEGORIES = [
  'AMICAL',
  'AMOUREUX',
  'SANS_LENDEMAIN',
  'MARIAGE',
  'PROFESSIONNEL',
] as const;

export type DatingCategory = (typeof DATING_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<DatingCategory, string> = {
  AMICAL: 'Amical',
  AMOUREUX: 'Amoureux',
  SANS_LENDEMAIN: 'Sans Lendemain',
  MARIAGE: 'Mariage',
  PROFESSIONNEL: 'Professionnel',
};

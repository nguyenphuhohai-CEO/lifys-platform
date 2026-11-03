import { ROWS } from './rows.js';
import { LEGAL_ROWS } from './legalRows.js';

const build = (index) => {
  const map = {};
  for (const row of [...ROWS, ...LEGAL_ROWS]) {
    map[row[0]] = row[index];
  }
  return map;
};

export const translations = { fr: {}, en: build(1), es: build(2), vi: build(3) };


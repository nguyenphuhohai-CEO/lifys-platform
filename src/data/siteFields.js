const NO_ANSWER = 'Préfère ne pas dire';

export const SITE_FIELDS = {
  amoureux: [
    { id: 'situation', type: 'select', label: 'Situation', options: ['Célibataire', 'Divorcé(e)', 'Veuf / veuve'] },
    { id: 'children', type: 'select', label: 'Enfants', options: ['Sans enfant', 'Avec enfant(s)', 'Souhaite des enfants'] },
    { id: 'smoker', type: 'select', label: 'Fumeur', options: ['Non', 'Occasionnellement', 'Oui'] },
    { id: 'looking', type: 'select', label: 'Je recherche', options: ['Relation durable', 'À découvrir', 'Peu importe'] },
    { id: 'promptQ', type: 'select', label: 'Question de profil', options: ['Mon dimanche idéal','Ce qui me fait craquer','Un voyage inoubliable','Ma plus grande passion'] },
    { id: 'promptA', type: 'longtext', label: 'Ma réponse' },
  ],
  amical: [
    { id: 'activities', type: 'tags', label: 'Activités favorites' },
    { id: 'availability', type: 'select', label: 'Disponibilités', options: ['En semaine', 'Le week-end', 'En soirée', 'Flexible'] },
    { id: 'wantedAgeMin', type: 'number', label: 'Âge recherché (min)' },
    { id: 'wantedAgeMax', type: 'number', label: 'Âge recherché (max)' },
    { id: 'promptQ', type: 'select', label: 'Question de profil', options: ['Mon activité préférée entre amis','Un lieu à me faire découvrir','Ce que j’aimerais apprendre','Mon meilleur souvenir entre amis'] },
    { id: 'promptA', type: 'longtext', label: 'Ma réponse' },
  ],
  'sans-lendemain': [
    { id: 'expectations', type: 'select', label: 'Attentes', options: ['Une soirée', 'Discuter puis voir', 'Récurrent sans attache'] },
    { id: 'discretion', type: 'select', label: 'Discrétion', options: ['Très discret(e)', 'Normale', 'Aucune'] },
    { id: 'consent', type: 'bool', label: 'Je m’engage au respect et au consentement mutuel' },
    { id: 'tonight', type: 'bool', label: 'Disponible ce soir (actif 12 h)' },
    { id: 'promptQ', type: 'select', label: 'Question de profil', options: ['Mon ambiance idéale','Mes limites claires','Ma soirée parfaite'] },
    { id: 'promptA', type: 'longtext', label: 'Ma réponse' },
  ],
  mariage: [
    { id: 'religion', type: 'select', label: 'Religion', options: ['Chrétienne', 'Musulmane', 'Juive', 'Bouddhiste', 'Athée / agnostique', 'Autre', NO_ANSWER] },
    { id: 'values', type: 'tags', label: 'Valeurs' },
    { id: 'childrenPlan', type: 'select', label: 'Projet d’enfants', options: ['Oui', 'Non', 'Ouvert'] },
    { id: 'relocate', type: 'select', label: 'Prêt(e) à déménager', options: ['Oui', 'Non', 'Selon le projet'] },
    { id: 'family', type: 'text', label: 'Ma famille en quelques mots' },
    { id: 'promptQ', type: 'select', label: 'Question de profil', options: ['Ma vision du couple','Une valeur non négociable','Notre foyer idéal','Ce que j’attends d’un mariage'] },
    { id: 'promptA', type: 'longtext', label: 'Ma réponse' },
  ],
  professionnel: [
    { id: 'job', type: 'text', label: 'Métier' },
    { id: 'company', type: 'text', label: 'Entreprise' },
    { id: 'sector', type: 'select', label: 'Secteur', options: ['Tech', 'Design', 'Marketing', 'Finance', 'Santé', 'Éducation', 'Conseil', 'Autre'] },
    { id: 'skills', type: 'tags', label: 'Compétences' },
    { id: 'goal', type: 'select', label: 'Objectif', options: ['Recruter', 'Collaborer', 'Mentor', 'Réseauter'] },
    { id: 'linkedin', type: 'url', label: 'Lien LinkedIn' },
    { id: 'promptQ', type: 'select', label: 'Question de profil', options: ['Ce que je recherche en collaboration','Mon plus beau projet','Comment je peux aider','Mon conseil carrière'] },
    { id: 'promptA', type: 'longtext', label: 'Ma réponse' },
  ],
};

function cleanTags(value) {
  const items = Array.isArray(value) ? value : `${value ?? ''}`.split(',');
  return [...new Set(items.map((item) => `${item ?? ''}`.trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 12);
}

export function sanitizeDetails(site, raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const details = {};

  for (const field of SITE_FIELDS[site] ?? []) {
    const value = source[field.id];
    if (field.type === 'select') {
      if (field.options.includes(value)) details[field.id] = value;
    } else if (field.type === 'tags') {
      const tags = cleanTags(value);
      if (tags.length) details[field.id] = tags;
    } else if (field.type === 'longtext') {
      const text = `${value ?? ''}`.trim().slice(0, 240);
      if (text) details[field.id] = text;
    } else if (field.type === 'text') {
      const text = `${value ?? ''}`.trim().slice(0, 120);
      if (text) details[field.id] = text;
    } else if (field.type === 'number') {
      const number = Number(value);
      if (value !== '' && value != null && Number.isFinite(number) && number >= 18 && number <= 99) details[field.id] = number;
    } else if (field.type === 'bool') {
      if (value === true || value === 'true') details[field.id] = true;
    } else if (field.type === 'url') {
      const url = `${value ?? ''}`.trim();
      if (/^https:\/\/([a-z0-9-]+\.)*linkedin\.com\/[^\s<>"]{0,200}$/i.test(url)) details[field.id] = url;
    }
  }

  if (!details.promptQ || !details.promptA) {
    delete details.promptQ;
    delete details.promptA;
  }

  return details;
}

function shared(a = [], b = []) {
  return a.filter((item) => b.includes(item));
}

function same(a, b) {
  return a !== undefined && a === b && a !== NO_ANSWER;
}

const PRO_COMPLEMENTS = { Recruter: ['Collaborer', 'Réseauter'], Collaborer: ['Recruter', 'Collaborer'], Mentor: ['Réseauter'], Réseauter: ['Mentor', 'Recruter'] };

export function computeCompatibility(current, target) {
  const a = current.details ?? {};
  const b = target.details ?? {};
  const reasons = [];
  let score = 40;
  const add = (points, reason) => {
    score += points;
    reasons.push(reason);
  };

  if (shared(current.interests, target.interests).length) add(Math.min(20, shared(current.interests, target.interests).length * 10), 'Centres d’intérêt communs');
  if (current.city && current.city.toLowerCase() === target.city.toLowerCase()) add(10, 'Même ville');

  switch (current.mode) {
    case 'mariage':
      if (shared(a.values, b.values).length) add(Math.min(20, shared(a.values, b.values).length * 10), 'Valeurs communes');
      if (same(a.childrenPlan, b.childrenPlan)) add(10, 'Même projet d’enfants');
      if (same(a.religion, b.religion)) add(10, 'Même religion');
      break;
    case 'professionnel':
      if (shared(a.skills, b.skills).length) add(Math.min(20, shared(a.skills, b.skills).length * 10), 'Compétences communes');
      if (same(a.sector, b.sector)) add(10, 'Même secteur');
      if (same(a.goal, b.goal)) add(10, 'Même objectif');
      if (PRO_COMPLEMENTS[a.goal]?.includes(b.goal)) add(15, 'Objectifs complémentaires');
      break;
    case 'amical':
      if (shared(a.activities, b.activities).length) add(Math.min(20, shared(a.activities, b.activities).length * 10), 'Activités communes');
      if (same(a.availability, b.availability)) add(10, 'Mêmes disponibilités');
      break;
    case 'amoureux':
      if (same(a.looking, b.looking)) add(15, 'Même recherche');
      if (same(a.smoker, b.smoker)) add(5, 'Même rapport au tabac');
      break;
    case 'sans-lendemain':
      if (same(a.expectations, b.expectations)) add(15, 'Mêmes attentes');
      if (same(a.discretion, b.discretion)) add(10, 'Même niveau de discrétion');
      if (a.tonight && b.tonight) add(10, 'Tous deux disponibles ce soir');
      break;
    default:
  }

  return { score: Math.min(score, 99), reasons };
}

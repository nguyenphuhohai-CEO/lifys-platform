export const MODES = [
  { id: 'amical', label: 'Amical', accent: '#9a7cff', icon: '💙' },
  { id: 'amoureux', label: 'Amoureux', accent: '#ff6bb5', icon: '💜' },
  { id: 'sans-lendemain', label: 'Sans lendemain', accent: '#ff8c42', icon: '🔥' },
  { id: 'mariage', label: 'Mariage', accent: '#f7c948', icon: '💍' },
  { id: 'professionnel', label: 'Professionnel', accent: '#52c7c0', icon: '💼' },
];

export const NAV_ITEMS = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'profile', label: 'Profil' },
];

export const DEMO_PROFILES = [
  { id: 'p1', name: 'Mila', age: 28, city: 'Paris', bio: 'Passionnée par les balades nocturnes et les bons plans culturels.', interests: ['cinéma', 'voyage', 'sport'], mode: 'amoureux', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80' },
  { id: 'p2', name: 'Lucas', age: 31, city: 'Lyon', bio: 'Tombé amoureux de la cuisine italienne et des conversations profondes.', interests: ['cuisine', 'musique', 'lecture'], mode: 'amoureux', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80' },
  { id: 'p3', name: 'Nora', age: 26, city: 'Paris', bio: 'Je cherche des rencontres joyeuses et des aventures spontanées.', interests: ['danse', 'art', 'soirées'], mode: 'sans-lendemain', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80' },
  { id: 'p4', name: 'Yanis', age: 34, city: 'Marseille', bio: 'Fan de roadtrip, cafés insolites et sorties en groupe.', interests: ['roadtrip', 'café', 'sport'], mode: 'amical', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80' },
  { id: 'p5', name: 'Sophie', age: 29, city: 'Paris', bio: 'Je veux rencontrer quelqu’un pour construire une vie pleine de sens.', interests: ['famille', 'nature', 'yoga'], mode: 'mariage', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80' },
  { id: 'p6', name: 'Omar', age: 37, city: 'Lille', bio: 'Product designer, amateur de projets ambitieux et d’échanges inspirants.', interests: ['design', 'startups', 'marketing'], mode: 'professionnel', avatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80' },
  { id: 'p7', name: 'Claire', age: 27, city: 'Bordeaux', bio: 'Amatrice d’apéros, de musique live et de rencontres authentiques.', interests: ['musique', 'café', 'voyage'], mode: 'amical', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80' },
  { id: 'p8', name: 'Theo', age: 32, city: 'Paris', bio: 'Entretiens des projets de vie simples et un goût prononcé pour la culture.', interests: ['lecture', 'nature', 'art'], mode: 'mariage', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80' },
  { id: 'p9', name: 'Lea', age: 30, city: 'Nantes', bio: 'Consultante, curieuse, drôle et ouverte à des rencontres profondes.', interests: ['travail', 'sport', 'cinéma'], mode: 'professionnel', avatar: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80' },
  { id: 'p10', name: 'Hugo', age: 25, city: 'Paris', bio: 'J’aime les soirées spontanées, les bonnes discussions et la joie de vivre.', interests: ['danse', 'nuit', 'amis'], mode: 'sans-lendemain', avatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80' },
];

export const DEFAULT_MESSAGES = [
  {
    id: 'conv1',
    profileId: 'p2',
    name: 'Lucas',
    mode: 'amoureux',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    messages: [
      { id: 'm1', sender: 'them', text: 'Salut ! J’aime ton profil, on a beaucoup de points communs.' },
      { id: 'm2', sender: 'me', text: 'Merci ! J’adore les beaux restaurants et les conversations longues.' },
      { id: 'm3', sender: 'them', text: 'Top, on devrait parler de voyage et de musique.' },
    ],
  },
  {
    id: 'conv2',
    profileId: 'p6',
    name: 'Omar',
    mode: 'professionnel',
    avatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80',
    messages: [
      { id: 'm4', sender: 'them', text: 'Bonjour, je suis intéressé par ton profil pro et tes valeurs.' },
      { id: 'm5', sender: 'me', text: 'Super, j’ai déjà envie d’échanger sur les projets créatifs.' },
    ],
  },
];

export const STORAGE_KEYS = {
  profile: 'lifys-profile',
  likes: 'lifys-likes',
  matches: 'lifys-matches',
  messages: 'lifys-messages',
  passed: 'lifys-passed',
  activeMode: 'lifys-active-mode',
};

export const DEFAULT_PROFILE = {
  name: '',
  age: 28,
  city: '',
  bio: '',
  interests: '',
  mode: 'amoureux',
  avatar: '',
};

export const AVATAR_FALLBACK =
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80';

export const MODES = [
  { id: 'amical', label: 'Amical', accent: '#8b7dff', icon: '💙', description: 'Rencontres amicales et sorties conviviales.' },
  { id: 'amoureux', label: 'Amoureux', accent: '#ff5da8', icon: '💜', description: 'Relations sincères et compatibilités durables.' },
  { id: 'sans-lendemain', label: 'Sans lendemain', accent: '#ff9550', icon: '🔥', description: 'Rencontres libres, assumées et respectueuses.' },
  { id: 'mariage', label: 'Mariage', accent: '#e6b84e', icon: '💍', description: 'Projets de vie sérieux et valeurs partagées.' },
  { id: 'professionnel', label: 'Professionnel', accent: '#4fbeb4', icon: '💼', description: 'Networking, mentoring et opportunités qualifiées.' },
];

export const NAV_ITEMS = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'profile', label: 'Profil' },
];

export const DEMO_PROFILES = [
  { id: 'p1', name: 'Mila', age: 28, city: 'Paris', bio: 'Passionnée par les balades nocturnes, les expositions et les cafés feutrés.', interests: ['cinéma', 'voyages', 'sport'], mode: 'amoureux', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80' },
  { id: 'p2', name: 'Lucas', age: 31, city: 'Lyon', bio: 'Chef amateur et amoureux des conversations profondes autour d’une belle table.', interests: ['cuisine', 'musique', 'lecture'], mode: 'amoureux', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80' },
  { id: 'p3', name: 'Nora', age: 26, city: 'Paris', bio: 'Curieuse, directe et toujours partante pour une soirée qui change du quotidien.', interests: ['danse', 'art', 'soirées'], mode: 'sans-lendemain', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80' },
  { id: 'p4', name: 'Yanis', age: 34, city: 'Marseille', bio: 'Fan de road trips, de cafés insolites et de rencontres simples qui font du bien.', interests: ['road trips', 'café', 'randonnée'], mode: 'amical', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80' },
  { id: 'p5', name: 'Sophie', age: 29, city: 'Paris', bio: 'Je cherche une relation stable, douce et tournée vers un futur solide.', interests: ['famille', 'nature', 'yoga'], mode: 'mariage', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80' },
  { id: 'p6', name: 'Omar', age: 37, city: 'Lille', bio: 'Product designer, j’aime les projets ambitieux et les échanges qui font avancer.', interests: ['design', 'startups', 'marketing'], mode: 'professionnel', avatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80' },
  { id: 'p7', name: 'Claire', age: 27, city: 'Bordeaux', bio: 'Entre musique live, apéros et week-ends spontanés, je privilégie les liens vrais.', interests: ['musique', 'café', 'voyages'], mode: 'amical', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80' },
  { id: 'p8', name: 'Théo', age: 32, city: 'Paris', bio: 'J’avance avec calme, humour et un goût prononcé pour la culture et la simplicité.', interests: ['lecture', 'nature', 'art'], mode: 'mariage', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80' },
  { id: 'p9', name: 'Léa', age: 30, city: 'Nantes', bio: 'Consultante, drôle et curieuse, j’aime connecter les bonnes personnes au bon moment.', interests: ['stratégie', 'sport', 'cinéma'], mode: 'professionnel', avatar: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80' },
  { id: 'p10', name: 'Hugo', age: 25, city: 'Paris', bio: 'Spontané, sociable et toujours partant pour sortir de la routine avec élégance.', interests: ['danse', 'nuit', 'amis'], mode: 'sans-lendemain', avatar: 'https://images.unsplash.com/photo-1503665699095-cf0d7c5fe6d3?auto=format&fit=crop&w=400&q=80' },
];

export const DEFAULT_MESSAGES = [
  {
    id: 'conv1',
    profileId: 'p2',
    name: 'Lucas',
    city: 'Lyon',
    mode: 'amoureux',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    messages: [
      { id: 'm1', sender: 'them', text: 'Salut ! J’aime ton profil, on a plusieurs affinités.' },
      { id: 'm2', sender: 'me', text: 'Merci, j’ai beaucoup aimé ton univers aussi.' },
      { id: 'm3', sender: 'them', text: 'On échange sur nos meilleures adresses à Lyon et Paris ?' },
    ],
  },
  {
    id: 'conv2',
    profileId: 'p6',
    name: 'Omar',
    city: 'Lille',
    mode: 'professionnel',
    avatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80',
    messages: [
      { id: 'm4', sender: 'them', text: 'Bonjour, ton positionnement produit m’intéresse beaucoup.' },
      { id: 'm5', sender: 'me', text: 'Avec plaisir, je peux partager ma méthode et quelques idées.' },
    ],
  },
];

export const STORAGE_KEYS = {
  profile: 'lifys-profile',
  likes: 'lifys-likes',
  matches: 'lifys-matches',
  messages: 'lifys-messages',
  passed: 'lifys-passed',
};

export const defaultProfile = {
  name: '',
  age: 28,
  city: '',
  bio: '',
  interests: '',
  mode: 'amoureux',
  avatar: '',
};

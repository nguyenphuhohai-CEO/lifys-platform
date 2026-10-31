// Coordonnées approximatives (lat, lon) des principales villes, pour le filtre de distance.
const CITIES = {
  paris: [48.8566, 2.3522], lyon: [45.764, 4.8357], marseille: [43.2965, 5.3698], toulouse: [43.6047, 1.4442],
  nice: [43.7102, 7.262], nantes: [47.2184, -1.5536], montpellier: [43.6108, 3.8767], strasbourg: [48.5734, 7.7521],
  bordeaux: [44.8378, -0.5792], lille: [50.6292, 3.0573], rennes: [48.1173, -1.6778], reims: [49.2583, 4.0317],
  toulon: [43.1242, 5.928], 'saint-etienne': [45.4397, 4.3872], 'le havre': [49.4944, 0.1079], grenoble: [45.1885, 5.7245],
  dijon: [47.322, 5.0415], angers: [47.4784, -0.5632], nimes: [43.8367, 4.3601], 'clermont-ferrand': [45.7772, 3.087],
  'le mans': [48.0061, 0.1996], 'aix-en-provence': [43.5297, 5.4474], brest: [48.3904, -4.4861], tours: [47.3941, 0.6848],
  amiens: [49.8941, 2.2958], limoges: [45.8336, 1.2611], annecy: [45.8992, 6.1294], perpignan: [42.6887, 2.8948],
  metz: [49.1193, 6.1757], besancon: [47.2378, 6.0241], orleans: [47.9029, 1.9093], rouen: [49.4432, 1.0993],
  caen: [49.1829, -0.3707], nancy: [48.6921, 6.1844], avignon: [43.9493, 4.8055], poitiers: [46.5802, 0.3404],
  'la rochelle': [46.1603, -1.1511], cannes: [43.5528, 7.0174], pau: [43.2951, -0.3708], bayonne: [43.4929, -1.4748],
  ajaccio: [41.9192, 8.7386], bruxelles: [50.8503, 4.3517], geneve: [46.2044, 6.1432], lausanne: [46.5197, 6.6323],
  luxembourg: [49.6116, 6.1319], londres: [51.5074, -0.1278], london: [51.5074, -0.1278], madrid: [40.4168, -3.7038],
  barcelone: [41.3851, 2.1734], berlin: [52.52, 13.405], rome: [41.9028, 12.4964], montreal: [45.5017, -73.5673],
  'new york': [40.7128, -74.006], hanoi: [21.0285, 105.8542], 'ho chi minh': [10.8231, 106.6297], saigon: [10.8231, 106.6297],
  casablanca: [33.5731, -7.5898], alger: [36.7538, 3.0588], tunis: [36.8065, 10.1815], dakar: [14.7167, -17.4677],
  villeurbanne: [45.7667, 4.8803], 'saint-denis': [48.9362, 2.3574], 'boulogne-billancourt': [48.8397, 2.2399], versailles: [48.8014, 2.1301],
  'argenteuil': [48.9472, 2.2467], 'saint-nazaire': [47.2733, -2.2137], 'saint-malo': [48.6493, -2.0257], lorient: [47.7482, -3.3702],
  vannes: [47.6582, -2.7608], quimper: [47.996, -4.1024], cherbourg: [49.6337, -1.6221], dunkerque: [51.0344, 2.3768],
  calais: [50.9513, 1.8587], valenciennes: [50.3591, 3.5233], troyes: [48.2973, 4.0744], mulhouse: [47.7508, 7.3359],
  colmar: [48.0794, 7.3585], chambery: [45.5646, 5.9178], valence: [44.9334, 4.8924], 'saint-tropez': [43.2727, 6.6407],
  antibes: [43.5808, 7.1239], menton: [43.7764, 7.4947], bastia: [42.6977, 9.4509], biarritz: [43.4832, -1.5586],
  tarbes: [43.2328, 0.0781], agen: [44.2033, 0.6165], angouleme: [45.6484, 0.1562], niort: [46.3238, -0.4588],
  bourges: [47.0844, 2.3964], chartres: [48.4469, 1.4893], cholet: [47.0597, -0.8798], laval: [48.0698, -0.7704],
  cergy: [49.0364, 2.0763], creteil: [48.7904, 2.4556], evry: [48.6291, 2.4417],
  anvers: [51.2194, 4.4025], antwerp: [51.2194, 4.4025], liege: [50.6326, 5.5797], gand: [51.0543, 3.7174],
  zurich: [47.3769, 8.5417], berne: [46.948, 7.4474], bale: [47.5596, 7.5886], amsterdam: [52.3676, 4.9041],
  lisbonne: [38.7223, -9.1393], lisbon: [38.7223, -9.1393], porto: [41.1579, -8.6291], milan: [45.4642, 9.19],
  turin: [45.0703, 7.6869], naples: [40.8518, 14.2681], munich: [48.1351, 11.582], francfort: [50.1109, 8.6821],
  hambourg: [53.5511, 9.9937], vienne: [48.2082, 16.3738], prague: [50.0755, 14.4378], varsovie: [52.2297, 21.0122],
  athenes: [37.9838, 23.7275], istanbul: [41.0082, 28.9784], dublin: [53.3498, -6.2603], manchester: [53.4808, -2.2426],
  seville: [37.3891, -5.9845],
  toronto: [43.6532, -79.3832], quebec: [46.8139, -71.208], 'los angeles': [34.0522, -118.2437], chicago: [41.8781, -87.6298],
  'san francisco': [37.7749, -122.4194], miami: [25.7617, -80.1918], tokyo: [35.6762, 139.6503], 'da nang': [16.0544, 108.2022],
  'hai phong': [20.8449, 106.6881], 'can tho': [10.0452, 105.7469], hue: [16.4637, 107.5909], 'nha trang': [12.2388, 109.1967],
  bangkok: [13.7563, 100.5018], singapour: [1.3521, 103.8198], singapore: [1.3521, 103.8198], 'hong kong': [22.3193, 114.1694],
  dubai: [25.2048, 55.2708], marrakech: [31.6295, -7.9811], rabat: [34.0209, -6.8416], oran: [35.6971, -0.6308],
  abidjan: [5.36, -4.0083], 'saint-louis': [16.0179, -16.4896],
};

export function normalizeCity(value) {
  return `${value ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\- ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getCityCoordinates(city) {
  const name = normalizeCity(city);
  if (!name) return null;
  if (CITIES[name]) return CITIES[name];
  const key = Object.keys(CITIES).find((candidate) => name.startsWith(candidate + ' '));
  return key ? CITIES[key] : null;
}

export function distanceKm(cityA, cityB) {
  const a = getCityCoordinates(cityA);
  const b = getCityCoordinates(cityB);
  if (!a || !b) return null;
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(h)));
}

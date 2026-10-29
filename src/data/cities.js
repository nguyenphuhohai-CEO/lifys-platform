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

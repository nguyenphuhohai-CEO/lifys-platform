import fs from 'node:fs';

function patch(file, edits) {
  let s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const [a, b] of edits) {
    if (!s.includes(a)) throw new Error(`nf: ${file}: ${a.slice(0, 60)}`);
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(file, s.replace(/\n/g, '\r\n'));
}

patch('server/config.js', [
  ["    oauth: {", "    siteOnly: ['amical', 'amoureux', 'sans-lendemain', 'mariage', 'professionnel'].includes(`${overrides.SITE_ONLY ?? process.env.SITE_ONLY ?? ''}`.trim()) ? `${overrides.SITE_ONLY ?? process.env.SITE_ONLY}`.trim() : '',\n    oauth: {"],
]);

patch('server/app.js', [
  ["  app.use(express.json({ limit: '100kb' }));", `  app.use(express.json({ limit: '100kb' }));

  // Déploiement dédié à un seul site : le site est imposé côté serveur.
  app.get('/api/site', (_req, res) => {
    res.json({ siteOnly: config.siteOnly || null });
  });
  app.use('/api', (req, res, next) => {
    if (!config.siteOnly) {
      next();
      return;
    }
    if (req.path === '/auth/switch-site' && req.body?.site !== config.siteOnly) {
      next(createHttpError(403, 'Ce site est indépendant des autres sites Lifys.'));
      return;
    }
    if (req.body && typeof req.body === 'object') {
      if ('mode' in req.body || req.path === '/auth/register' || req.path === '/profile') req.body.mode = config.siteOnly;
      if (req.path === '/auth/login' || req.path === '/auth/switch-site') req.body.site = config.siteOnly;
    }
    if (req.query.site) req.query.site = config.siteOnly;
    if (req.query.mode && req.query.mode !== 'all') req.query.mode = config.siteOnly;
    next();
  });`],
]);

fs.writeFileSync('src/utils/siteLock.js', `const HOST_PREFIXES = {
  amis: 'amical', amical: 'amical',
  love: 'amoureux', amour: 'amoureux', amoureux: 'amoureux',
  ephemere: 'sans-lendemain', 'sans-lendemain': 'sans-lendemain',
  mariage: 'mariage',
  pro: 'professionnel', professionnel: 'professionnel',
};

// Un site dédié est déduit du sous-domaine (amis.lifys.com, pro.lifys.com…).
export function getSiteFromHostname(hostname = window.location.hostname) {
  const parts = String(hostname).toLowerCase().split('.');
  return parts.length >= 3 ? HOST_PREFIXES[parts[0]] ?? null : null;
}

export async function fetchSiteOnly() {
  try {
    const response = await fetch(\`\${import.meta.env.VITE_API_BASE_URL ?? ''}/api/site\`);
    return (await response.json()).siteOnly ?? null;
  } catch {
    return null;
  }
}
`.replace(/\n/g, '\r\n'));

patch('src/main.jsx', [
  ["import { getLegalPage, getModeFromPathname } from './utils/routing';", "import { getLegalPage, getModeFromPathname } from './utils/routing';\nimport { fetchSiteOnly, getSiteFromHostname } from './utils/siteLock';"],
  ["  const [pathname, setPathname] = useState(window.location.pathname);", "  const [pathname, setPathname] = useState(window.location.pathname);\n  const [lockedSite, setLockedSite] = useState(() => getSiteFromHostname() ?? undefined);\n\n  useEffect(() => {\n    if (lockedSite === undefined) fetchSiteOnly().then((site) => setLockedSite(site));\n  }, [lockedSite]);"],
  ["  const mode = getModeFromPathname(pathname);", "  if (lockedSite === undefined) {\n    return null;\n  }\n  if (lockedSite) {\n    return <App key={lockedSite} site={lockedSite} dedicated />;\n  }\n\n  const mode = getModeFromPathname(pathname);"],
]);

patch('src/App.jsx', [
  ["function App({ site }) {", "function App({ site, dedicated = false }) {"],
  ["                <a href=\"/\" onClick={(event) => { event.preventDefault(); navigate('/'); }}>{t('Découvrir les autres sites Lifys')}</a>", "                {dedicated ? null : <a href=\"/\" onClick={(event) => { event.preventDefault(); navigate('/'); }}>{t('Découvrir les autres sites Lifys')}</a>}"],
  ["<p><a href=\"/\" onClick={(event) => { event.preventDefault(); navigate('/'); }}>{t('Découvrir les autres sites Lifys')}</a></p>", "{dedicated ? null : <p><a href=\"/\" onClick={(event) => { event.preventDefault(); navigate('/'); }}>{t('Découvrir les autres sites Lifys')}</a></p>}"],
  ["        <SiteRail token", "        {dedicated ? null : <SiteRail token"],
  ["onSwitch={handleSiteChange} />", "onSwitch={handleSiteChange} />}"],
]);

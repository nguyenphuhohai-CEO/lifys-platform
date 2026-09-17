import { useCallback, useEffect, useMemo, useState } from 'react';

import Avatar from './components/Avatar';
import ToastRegion from './components/ToastRegion';
import { MODES, defaultProfile } from './data/demoData';
import { api, ApiError } from './lib/api';
import { getConversationPreview, getModeById, serializeInterests } from './utils/app-utils';
import { STORAGE_KEYS, resetPrototypeStorage, safeReadJSON, safeWriteJSON } from './utils/storage';

const NAV_ITEMS = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'profile', label: 'Profil' },
];

const initialAuth = safeReadJSON(STORAGE_KEYS.auth, { token: '' }, {
  sanitize: (value) => ({
    token: typeof value?.token === 'string' ? value.token : '',
  }),
}).data;

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction ? <button type="button" className="secondary-button" onClick={onAction}>{actionLabel}</button> : null}
    </div>
  );
}

function SectionHeader({ eyebrow, title, description, aside }) {
  return (
    <div className="panel-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}

function App() {
  const [token, setToken] = useState(initialAuth.token);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('home');
  const [activeMode, setActiveMode] = useState('all');
  const [profile, setProfile] = useState(defaultProfile);
  const [profileDraft, setProfileDraft] = useState(defaultProfile);
  const [profileErrors, setProfileErrors] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pageError, setPageError] = useState('');
  const [authMode, setAuthMode] = useState('register');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    mode: 'amoureux',
  });

  const showToast = useCallback((toast) => {
    const id = `${toast.type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const handleApiError = useCallback((error, fallbackMessage) => {
    const message = error instanceof ApiError ? error.message : fallbackMessage;
    setPageError(message);
    showToast({
      type: 'warning',
      title: 'Action interrompue',
      message,
    });
  }, [showToast]);

  useEffect(() => {
    if (token) {
      safeWriteJSON(STORAGE_KEYS.auth, { token });
    } else {
      resetPrototypeStorage([STORAGE_KEYS.auth]);
    }
  }, [token]);

  const loadDiscovery = useCallback(async (authToken) => {
    setDiscoveryLoading(true);

    try {
      const response = await api.getDiscovery(authToken, {
        activeMode,
        query: searchQuery,
        city: cityQuery,
      });
      setProfiles(response.profiles);
      setPageError('');
    } catch (error) {
      handleApiError(error, 'Impossible de charger la découverte.');
    } finally {
      setDiscoveryLoading(false);
    }
  }, [activeMode, cityQuery, handleApiError, searchQuery]);

  const loadDashboard = useCallback(async (authToken) => {
    setDashboardLoading(true);

    try {
      const [sessionData, bootstrapData, discoveryData] = await Promise.all([
        api.getSession(authToken),
        api.getBootstrap(authToken),
        api.getDiscovery(authToken, {
          activeMode,
          query: searchQuery,
          city: cityQuery,
        }),
      ]);

      setCurrentUser(sessionData.user);
      setProfile(bootstrapData.profile);
      setProfileDraft({
        ...bootstrapData.profile,
        interests: serializeInterests(bootstrapData.profile.interests),
      });
      setMatches(bootstrapData.matches);
      setConversations(bootstrapData.conversations);
      setProfiles(discoveryData.profiles);
      setSelectedConversation((current) => (
        bootstrapData.conversations.some((conversation) => conversation.id === current)
          ? current
          : bootstrapData.conversations[0]?.id ?? null
      ));
      setPageError('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setToken('');
        setCurrentUser(null);
      }
      handleApiError(error, 'Impossible de charger votre espace Lifys.');
    } finally {
      setDashboardLoading(false);
      setSessionLoading(false);
    }
  }, [activeMode, cityQuery, handleApiError, searchQuery]);

  useEffect(() => {
    if (!token) {
      setSessionLoading(false);
      setCurrentUser(null);
      return;
    }

    loadDashboard(token);
  }, [loadDashboard, token]);

  useEffect(() => {
    if (currentUser && token) {
      loadDiscovery(token);
    }
  }, [activeMode, cityQuery, currentUser, loadDiscovery, searchQuery, token]);

  useEffect(() => {
    setProfileDraft((current) => ({
      ...current,
      ...profile,
      interests: serializeInterests(profile.interests),
    }));
  }, [profile]);

  useEffect(() => {
    if (!conversations.some((conversation) => conversation.id === selectedConversation)) {
      setSelectedConversation(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedConversation]);

  const selectedConversationData = conversations.find((conversation) => conversation.id === selectedConversation) ?? null;
  const availableCities = useMemo(() => [...new Set(profiles.map((item) => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [profiles]);
  const completedProfile = Boolean(profile.name && profile.age && profile.city && profile.bio);

  const validateProfile = () => {
    const errors = {};

    if (!profileDraft.name.trim()) {
      errors.name = 'Ajoutez votre prénom.';
    }
    if (!profileDraft.age || Number(profileDraft.age) < 18 || Number(profileDraft.age) > 80) {
      errors.age = 'Indiquez un âge entre 18 et 80 ans.';
    }
    if (!profileDraft.city.trim()) {
      errors.city = 'Ajoutez une ville.';
    }
    if (profileDraft.bio.trim().length < 20) {
      errors.bio = 'Décrivez-vous en au moins 20 caractères.';
    }
    if (profileDraft.avatar && !/^https?:\/\//i.test(profileDraft.avatar.trim())) {
      errors.avatar = 'Utilisez une URL commençant par http:// ou https://.';
    }

    return errors;
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthSubmitting(true);

    try {
      const response = authMode === 'register'
        ? await api.register(authForm)
        : await api.login({ email: authForm.email, password: authForm.password });

      setToken(response.token);
      setCurrentUser(response.user);
      setView('profile');
      showToast({
        type: 'success',
        title: authMode === 'register' ? 'Compte créé' : 'Connexion réussie',
        message: 'Votre session Lifys locale est prête.',
      });
      setPageError('');
    } catch (error) {
      handleApiError(error, 'Impossible de démarrer votre session.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    const errors = validateProfile();
    setProfileErrors(errors);

    if (Object.keys(errors).length) {
      showToast({
        type: 'warning',
        title: 'Profil incomplet',
        message: 'Corrigez les champs signalés avant l’enregistrement.',
      });
      return;
    }

    setProfileSaving(true);

    try {
      const response = await api.updateProfile(token, profileDraft);
      setProfile(response.profile);
      setProfileDraft({
        ...response.profile,
        interests: serializeInterests(response.profile.interests),
      });
      setProfileErrors({});
      setView('discover');
      setPageError('');
      showToast({
        type: 'success',
        title: 'Profil synchronisé',
        message: 'Votre profil est maintenant enregistré localement.',
      });
      await loadDiscovery(token);
    } catch (error) {
      handleApiError(error, 'Impossible de sauvegarder le profil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLike = async (profileId) => {
    try {
      const response = await api.likeProfile(token, profileId);
      await loadDashboard(token);

      if (response.matched) {
        setSelectedConversation(response.conversationId);
        showToast({
          type: 'success',
          title: 'Match confirmé',
          message: 'Un match a été créé et une conversation locale a été ouverte.',
        });
      } else {
        showToast({
          type: 'info',
          title: 'Like enregistré',
          message: 'Votre intérêt a été sauvegardé localement.',
        });
      }
    } catch (error) {
      handleApiError(error, 'Impossible d’enregistrer ce like.');
    }
  };

  const handlePass = async (profileId) => {
    try {
      await api.passProfile(token, profileId);
      await loadDiscovery(token);
    } catch (error) {
      handleApiError(error, 'Impossible d’enregistrer ce pass.');
    }
  };

  const handleSendMessage = async () => {
    const text = draftMessage.trim();
    if (!text || !selectedConversationData) {
      return;
    }

    setMessageSending(true);

    try {
      const response = await api.sendMessage(token, selectedConversationData.id, text);
      setConversations((current) => current.map((conversation) => (
        conversation.id === response.conversation.id ? response.conversation : conversation
      )));
      setDraftMessage('');
      setPageError('');
    } catch (error) {
      handleApiError(error, 'Impossible d’envoyer le message.');
    } finally {
      setMessageSending(false);
    }
  };

  const handleResetPrototype = async () => {
    setResetting(true);

    try {
      const response = await api.resetPrototype(token);
      setProfile(response.profile);
      setProfileDraft({
        ...response.profile,
        interests: serializeInterests(response.profile.interests),
      });
      setMatches(response.matches);
      setConversations(response.conversations);
      setSelectedConversation(response.conversations[0]?.id ?? null);
      setSearchQuery('');
      setCityQuery('');
      setActiveMode('all');
      setDraftMessage('');
      resetPrototypeStorage(Object.values(STORAGE_KEYS));
      safeWriteJSON(STORAGE_KEYS.auth, { token });
      await loadDiscovery(token);
      showToast({
        type: 'success',
        title: 'Données de démonstration réinitialisées',
        message: 'Vos interactions locales ont été effacées et un profil vierge a été restauré.',
      });
    } catch (error) {
      handleApiError(error, 'Impossible de réinitialiser le prototype.');
    } finally {
      setResetting(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setCurrentUser(null);
    setProfile(defaultProfile);
    setProfileDraft(defaultProfile);
    setProfiles([]);
    setMatches([]);
    setConversations([]);
    setSelectedConversation(null);
    setDraftMessage('');
    setPageError('');
    showToast({
      type: 'info',
      title: 'Session fermée',
      message: 'Votre jeton local a été supprimé du navigateur.',
    });
  };

  const updateProfileField = (field, value) => {
    setProfileDraft((current) => ({ ...current, [field]: value }));
  };

  const setCurrentView = (nextView) => {
    setView(nextView);
    setIsMobileNavOpen(false);
  };

  if (sessionLoading) {
    return (
      <div className="app-shell app-loading">
        <div className="content-panel loading-panel" role="status" aria-live="polite">
          <p className="eyebrow">Chargement</p>
          <h1>Lifys établit la connexion sécurisée…</h1>
          <p className="section-description">Initialisation de votre session locale et de vos données de démonstration.</p>
        </div>
      </div>
    );
  }

  if (!token || !currentUser) {
    return (
      <div className="app-shell">
        <ToastRegion toasts={toasts} onDismiss={(toastId) => setToasts((current) => current.filter((item) => item.id !== toastId))} />
        <main className="page-shell">
          <section className="hero-panel auth-hero">
            <div className="hero-copy">
              <p className="eyebrow">MVP local · données simulées</p>
              <h1>Lifys propose une expérience premium prête à itérer.</h1>
              <p>
                Ce MVP reste volontairement local : profils fictifs de démonstration, interactions stockées dans votre instance
                Lifys et expérience optimisée pour valider le produit avant industrialisation backend.
              </p>
              <div className="hero-metrics">
                <article className="metric-card">
                  <span>Prototype</span>
                  <strong>Local</strong>
                  <small>sans dépendance cloud</small>
                </article>
                <article className="metric-card">
                  <span>Persistance</span>
                  <strong>SQLite + localStorage</strong>
                  <small>données locales et fallback</small>
                </article>
                <article className="metric-card">
                  <span>Catégories</span>
                  <strong>5 modes</strong>
                  <small>amical à professionnel</small>
                </article>
              </div>
            </div>

            <div className="content-panel auth-card">
              <SectionHeader
                eyebrow={authMode === 'register' ? 'Créer un compte' : 'Connexion'}
                title={authMode === 'register' ? 'Commencer sur Lifys' : 'Reprendre votre session'}
                description="Ce MVP fonctionne en local : les données restent dans votre environnement Lifys et les profils de découverte sont fictifs."
              />

              {pageError ? <div className="form-alert" role="alert">{pageError}</div> : null}

              <form className="profile-form" onSubmit={handleAuthSubmit}>
                {authMode === 'register' ? (
                  <label>
                    <span>Prénom</span>
                    <input value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                ) : null}
                <label>
                  <span>E-mail</span>
                  <input type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} />
                </label>
                <label>
                  <span>Mot de passe</span>
                  <input type="password" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} />
                </label>
                {authMode === 'register' ? (
                  <label>
                    <span>Catégorie principale</span>
                    <select value={authForm.mode} onChange={(event) => setAuthForm((current) => ({ ...current, mode: event.target.value }))}>
                      {MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                    </select>
                  </label>
                ) : null}
                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={authSubmitting}>
                    {authSubmitting ? 'Chargement…' : authMode === 'register' ? 'Créer mon compte' : 'Se connecter'}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setAuthMode((current) => current === 'register' ? 'login' : 'register')}>
                    {authMode === 'register' ? 'J’ai déjà un compte' : 'Créer un nouveau compte'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ToastRegion toasts={toasts} onDismiss={(toastId) => setToasts((current) => current.filter((item) => item.id !== toastId))} />

      <header className="topbar">
        <button type="button" className="brand-block" onClick={() => setCurrentView('home')}>
          <span className="brand-icon">❤</span>
          <span>
            <strong>Lifys</strong>
            <small>Prototype React + Vite · données locales</small>
          </span>
        </button>

        <button
          type="button"
          className="mobile-nav-toggle"
          aria-expanded={isMobileNavOpen}
          aria-controls="lifys-main-nav"
          onClick={() => setIsMobileNavOpen((current) => !current)}
        >
          Menu
        </button>

        <nav id="lifys-main-nav" className={isMobileNavOpen ? 'nav nav-open' : 'nav'} aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? 'nav-button active' : 'nav-button'}
              onClick={() => setCurrentView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <span className="prototype-badge">{currentUser.email}</span>
          <button type="button" className="secondary-button" onClick={handleResetPrototype} disabled={resetting}>
            {resetting ? 'Réinitialisation…' : 'Réinitialiser'}
          </button>
          <button type="button" className="secondary-button" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="page-shell">
        <section className="local-notice" aria-label="Avertissement MVP">
          <strong>MVP local et simulé</strong>
          <span>Les interactions sont stockées localement sur cet appareil et les profils de découverte sont fictifs. Aucune identité réelle n’est vérifiée.</span>
        </section>

        {pageError ? <div className="form-alert" role="alert">{pageError}</div> : null}

        {view === 'home' && (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <span className="eyebrow">Expérience produit locale</span>
                <h1>Une base Lifys premium pour valider rapidement la proposition de valeur.</h1>
                <p>
                  Votre profil, vos likes, vos matchs et vos messages restent dans votre environnement local Lifys. Vous testez ainsi
                  le produit dans un cadre local, sobre et fiable, sans dépendance à un backend distant.
                </p>

                <div className="cta-row">
                  <button type="button" className="primary-button" onClick={() => setCurrentView('discover')}>Découvrir les profils</button>
                  <button type="button" className="secondary-button" onClick={() => setCurrentView('profile')}>
                    {completedProfile ? 'Modifier mon profil' : 'Compléter mon profil'}
                  </button>
                </div>

                <div className="hero-metrics">
                  <article className="metric-card">
                    <span>Profils</span>
                    <strong>{profiles.length}</strong>
                    <small>résultats locaux filtrés</small>
                  </article>
                  <article className="metric-card">
                    <span>Matchs</span>
                    <strong>{matches.length}</strong>
                    <small>persistés localement</small>
                  </article>
                  <article className="metric-card">
                    <span>Messages</span>
                    <strong>{conversations.reduce((count, conversation) => count + conversation.messages.length, 0)}</strong>
                    <small>conservés localement</small>
                  </article>
                </div>
              </div>

              <div className="hero-visual">
                <div className="mini-card large">
                  <span className="mini-label">Catégorie active</span>
                  <h3>{getModeById(profile.mode || 'amoureux').label}</h3>
                  <p>{profile.city || 'Ville à compléter'} · {profile.age || '18+'} ans</p>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Compte</span>
                  <strong>{completedProfile ? 'Actif' : 'À compléter'}</strong>
                  <p>{currentUser.email}</p>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Stack</span>
                  <strong>React + Express</strong>
                  <p>SQLite · JWT · UX premium</p>
                </div>
              </div>
            </section>

            <section className="mode-grid" aria-label="Choix de catégorie">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={activeMode === mode.id ? 'mode-card active' : 'mode-card'}
                  onClick={() => {
                    setActiveMode(mode.id);
                    setCurrentView('discover');
                  }}
                >
                  <span className="mode-icon" style={{ '--mode-accent': mode.accent }}>{mode.icon}</span>
                  <strong>{mode.label}</strong>
                  <small>{mode.description}</small>
                </button>
              ))}
            </section>
          </>
        )}

        {view === 'discover' && (
          <section className="content-panel">
            <SectionHeader
              eyebrow="Découverte"
              title="Profils recommandés"
              description="La découverte exclut automatiquement les profils déjà likés ou passés et applique vos filtres locaux."
              aside={(
                <div className="header-meta">
                  <span className="counter-badge">{discoveryLoading ? 'Chargement…' : `${profiles.length} profil${profiles.length > 1 ? 's' : ''}`}</span>
                </div>
              )}
            />

            <div className="discover-toolbar">
              <div className="mode-pills" aria-label="Filtre par catégorie">
                <button type="button" className={activeMode === 'all' ? 'pill active' : 'pill'} onClick={() => setActiveMode('all')}>Tous</button>
                {MODES.map((mode) => (
                  <button type="button" key={mode.id} className={activeMode === mode.id ? 'pill active' : 'pill'} onClick={() => setActiveMode(mode.id)}>
                    {mode.label}
                  </button>
                ))}
              </div>

              <div className="filter-grid">
                <label>
                  <span>Recherche texte</span>
                  <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Nom, bio, intérêt…" />
                </label>
                <label>
                  <span>Ville</span>
                  <input type="search" list="lifys-city-options" value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} placeholder="Paris, Lyon…" />
                  <datalist id="lifys-city-options">
                    {availableCities.map((city) => <option key={city} value={city} />)}
                  </datalist>
                </label>
              </div>
            </div>

            {discoveryLoading ? (
              <EmptyState title="Chargement des profils" description="Préparation de vos recommandations locales…" />
            ) : profiles.length === 0 ? (
              <EmptyState
                title="Aucun profil disponible"
                description="Essayez une autre catégorie, élargissez vos filtres ou réinitialisez vos interactions."
                actionLabel="Effacer les filtres"
                onAction={() => {
                  setSearchQuery('');
                  setCityQuery('');
                  setActiveMode('all');
                }}
              />
            ) : (
              <div className="discover-grid">
                {profiles.map((person) => (
                  <article key={person.id} className="profile-card">
                    <Avatar className="profile-avatar" src={person.avatar} alt={person.name} fallback={person.name} />
                    <div className="profile-card-body">
                      <div className="identity-row">
                        <div>
                          <h3>{person.name}, {person.age ?? '18+'}</h3>
                          <p className="city-line">📍 {person.city || 'Ville non précisée'}</p>
                        </div>
                        <span className="tag">{getModeById(person.mode).label}</span>
                      </div>
                      <p>{person.bio || 'Profil en cours de complétion.'}</p>
                      <div className="interest-row">
                        {(person.interests.length ? person.interests : ['profil']).map((item) => (
                          <span key={`${person.id}-${item}`}>{item}</span>
                        ))}
                      </div>
                    </div>
                    <div className="card-actions">
                      <button type="button" className="pass-button" onClick={() => handlePass(person.id)}>Pass</button>
                      <button type="button" className="like-button" onClick={() => handleLike(person.id)}>Like</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'matches' && (
          <section className="content-panel">
            <SectionHeader
              eyebrow="Matchs"
              title="Vos correspondances"
              description="Les matchs sont persistés localement et restent disponibles au prochain lancement."
            />

            {dashboardLoading ? (
              <EmptyState title="Chargement des matchs" description="Lecture de vos correspondances locales." />
            ) : matches.length === 0 ? (
              <EmptyState title="Aucun match pour l’instant" description="Commencez par liker des profils pour créer vos premières connexions." actionLabel="Voir la découverte" onAction={() => setCurrentView('discover')} />
            ) : (
              <div className="matches-list">
                {matches.map((match) => (
                  <article key={match.id} className="match-item">
                    <Avatar className="match-avatar" src={match.avatar} alt={match.name} fallback={match.name} />
                    <div className="match-copy">
                      <h3>{match.name}</h3>
                      <p>{match.city || 'Ville non précisée'} · {getModeById(match.mode).label}</p>
                      <small>{match.reason}</small>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => {
                      const conversation = conversations.find((item) => item.profileId === match.profileId);
                      setSelectedConversation(conversation?.id ?? null);
                      setCurrentView('messages');
                    }}>
                      Ouvrir la messagerie
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'messages' && (
          <section className="messages-layout">
            <aside className="content-panel conversation-panel">
              <SectionHeader eyebrow="Messages" title="Conversations" description="Historique local persistant avec envoi par Entrée." />

              {dashboardLoading ? (
                <EmptyState title="Chargement des conversations" description="Récupération de vos messages locaux." />
              ) : conversations.length === 0 ? (
                <EmptyState title="Aucune conversation" description="Un match local ouvre automatiquement un canal de discussion." actionLabel="Trouver un match" onAction={() => setCurrentView('discover')} />
              ) : (
                <div className="conversation-list">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className={selectedConversation === conversation.id ? 'conversation-item active' : 'conversation-item'}
                      onClick={() => setSelectedConversation(conversation.id)}
                    >
                      <Avatar className="conversation-avatar" src={conversation.avatar} alt={conversation.name} fallback={conversation.name} />
                      <div>
                        <strong>{conversation.name}</strong>
                        <small>{getConversationPreview(conversation)}</small>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <div className="content-panel chat-shell">
              {selectedConversationData ? (
                <div className="chat-panel">
                  <div className="chat-header">
                    <Avatar className="conversation-avatar" src={selectedConversationData.avatar} alt={selectedConversationData.name} fallback={selectedConversationData.name} />
                    <div>
                      <strong>{selectedConversationData.name}</strong>
                      <small>{getModeById(selectedConversationData.mode).label}</small>
                    </div>
                  </div>

                  <div className="chat-body" aria-live="polite">
                    {selectedConversationData.messages.length === 0 ? (
                      <EmptyState title="Aucun message" description="Envoyez le premier message pour démarrer cet échange local." />
                    ) : selectedConversationData.messages.map((message) => (
                      <div key={message.id} className={message.sender === 'me' ? 'bubble me' : 'bubble them'}>
                        {message.text}
                      </div>
                    ))}
                  </div>

                  <div className="composer">
                    <input
                      type="text"
                      placeholder="Écrire un message persistant…"
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <button type="button" className="primary-button" disabled={messageSending || !draftMessage.trim()} onClick={handleSendMessage}>
                      {messageSending ? 'Envoi…' : 'Envoyer'}
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState title="Sélectionnez une conversation" description="Choisissez un échange pour afficher les messages stockés localement." />
              )}
            </div>
          </section>
        )}

        {view === 'profile' && (
          <section className="content-panel profile-panel">
            <SectionHeader eyebrow="Profil" title="Complétez votre profil" description="Les mises à jour sont validées puis sauvegardées localement." />

            <div className="profile-layout">
              <form className="profile-form" onSubmit={handleProfileSave} noValidate>
                {Object.keys(profileErrors).length ? <div className="form-alert" role="alert">Corrigez les champs signalés avant de sauvegarder.</div> : null}

                <div className="form-grid">
                  <label>
                    <span>Prénom</span>
                    <input value={profileDraft.name} onChange={(event) => updateProfileField('name', event.target.value)} aria-invalid={Boolean(profileErrors.name)} />
                    {profileErrors.name ? <small className="field-error">{profileErrors.name}</small> : null}
                  </label>
                  <label>
                    <span>Âge</span>
                    <input type="number" min="18" max="80" value={profileDraft.age ?? ''} onChange={(event) => updateProfileField('age', event.target.value)} aria-invalid={Boolean(profileErrors.age)} />
                    {profileErrors.age ? <small className="field-error">{profileErrors.age}</small> : null}
                  </label>
                  <label>
                    <span>Ville</span>
                    <input value={profileDraft.city} onChange={(event) => updateProfileField('city', event.target.value)} aria-invalid={Boolean(profileErrors.city)} />
                    {profileErrors.city ? <small className="field-error">{profileErrors.city}</small> : null}
                  </label>
                  <label>
                    <span>Catégorie principale</span>
                    <select value={profileDraft.mode} onChange={(event) => updateProfileField('mode', event.target.value)}>
                      {MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
                    </select>
                  </label>
                </div>

                <label>
                  <span>Avatar URL</span>
                  <input value={profileDraft.avatar} onChange={(event) => updateProfileField('avatar', event.target.value)} aria-invalid={Boolean(profileErrors.avatar)} />
                  {profileErrors.avatar ? <small className="field-error">{profileErrors.avatar}</small> : null}
                </label>

                <label>
                  <span>Bio</span>
                  <textarea rows="5" value={profileDraft.bio} onChange={(event) => updateProfileField('bio', event.target.value)} aria-invalid={Boolean(profileErrors.bio)} />
                  {profileErrors.bio ? <small className="field-error">{profileErrors.bio}</small> : null}
                </label>

                <label>
                  <span>Centres d’intérêt</span>
                  <input
                    value={profileDraft.interests}
                    onChange={(event) => updateProfileField('interests', event.target.value)}
                    onBlur={(event) => updateProfileField('interests', serializeInterests(event.target.value))}
                    placeholder="Voyage, Musique, Sport"
                  />
                </label>

                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={profileSaving}>
                    {profileSaving ? 'Synchronisation…' : 'Sauvegarder le profil'}
                  </button>
                </div>
              </form>

              <aside className="profile-preview">
                <p className="eyebrow">Aperçu</p>
                <Avatar className="profile-preview-avatar" src={profileDraft.avatar} alt={profileDraft.name || 'Votre profil'} fallback={profileDraft.name || 'Lifys'} />
                <h3>{profileDraft.name || 'Votre prénom'}</h3>
                <p>{profileDraft.city || 'Ville'} · {profileDraft.age || '18+'} ans</p>
                <span className="tag">{getModeById(profileDraft.mode).label}</span>
                <p className="profile-preview-bio">{profileDraft.bio || 'Votre bio apparaîtra ici une fois complétée.'}</p>
                <div className="interest-row">
                  {(profileDraft.interests ? profileDraft.interests.split(',').map((item) => item.trim()).filter(Boolean) : ['Ajoutez vos centres d’intérêt']).map((item, index) => (
                    <span key={`${item}-${index}`}>{item}</span>
                  ))}
                </div>
              </aside>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Avatar from './components/Avatar';
import ToastRegion from './components/ToastRegion';
import { DEFAULT_MESSAGES, DEMO_PROFILES, MODES, defaultProfile } from './data/demoData';
import {
  createConversation,
  createMatch,
  filterProfiles,
  getConversationPreview,
  getModeById,
  loadInitialState,
  sanitizeConversations,
  sanitizeIdList,
  sanitizeMatches,
  sanitizeProfile,
  serializeInterests,
  shouldCreateMatch,
} from './utils/app-utils';
import { STORAGE_KEYS, resetPrototypeStorage, safeReadJSON, safeWriteJSON } from './utils/storage';

const NAV_ITEMS = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'profile', label: 'Profil' },
];

const PROTOTYPE_STORAGE_KEYS = [
  STORAGE_KEYS.profile,
  STORAGE_KEYS.likes,
  STORAGE_KEYS.matches,
  STORAGE_KEYS.messages,
  STORAGE_KEYS.passed,
];

const STORAGE_RECOVERY_LABELS = {
  profile: 'profil',
  likes: 'likes',
  passed: 'passes',
  matches: 'matchs',
  messages: 'messages',
};

const PERSISTENCE_ERROR_MESSAGE = 'Le navigateur n’a pas pu enregistrer les dernières données locales. Elles restent visibles pendant cette session uniquement.';
const RESET_ERROR_MESSAGE = 'Le navigateur n’a pas pu réinitialiser le stockage local. Réessayez pour vider les données enregistrées.';

function createProfileDraft(profileValue) {
  return {
    ...profileValue,
    interests: serializeInterests(profileValue.interests),
  };
}

function normalizeEditableProfile(profileValue) {
  const sanitized = sanitizeProfile(profileValue);

  return {
    name: sanitized.name,
    age: sanitized.age,
    city: sanitized.city,
    bio: sanitized.bio,
    interests: serializeInterests(sanitized.interests),
    mode: sanitized.mode,
    avatar: sanitized.avatar,
  };
}

function createInitialLocalState() {
  return loadInitialState({
    profile: () => safeReadJSON(STORAGE_KEYS.profile, defaultProfile, { sanitize: sanitizeProfile }),
    likes: () => safeReadJSON(STORAGE_KEYS.likes, [], { sanitize: sanitizeIdList }),
    passed: () => safeReadJSON(STORAGE_KEYS.passed, [], { sanitize: sanitizeIdList }),
    matches: () => safeReadJSON(STORAGE_KEYS.matches, [], { sanitize: sanitizeMatches }),
    messages: () => safeReadJSON(STORAGE_KEYS.messages, DEFAULT_MESSAGES, { sanitize: sanitizeConversations }),
  });
}

function formatRecoveredKeys(keys) {
  return keys.map((key) => STORAGE_RECOVERY_LABELS[key] ?? key).join(', ');
}

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
  const [bootstrappedState] = useState(createInitialLocalState);
  const [view, setView] = useState('home');
  const [activeMode, setActiveMode] = useState('all');
  const [profile, setProfile] = useState(bootstrappedState.profile);
  const [profileDraft, setProfileDraft] = useState(createProfileDraft(bootstrappedState.profile));
  const [profileErrors, setProfileErrors] = useState({});
  const [likes, setLikes] = useState(bootstrappedState.likes);
  const [passed, setPassed] = useState(bootstrappedState.passed);
  const [matches, setMatches] = useState(bootstrappedState.matches);
  const [conversations, setConversations] = useState(bootstrappedState.messages);
  const [selectedConversation, setSelectedConversation] = useState(bootstrappedState.messages[0]?.id ?? null);
  const [draftMessage, setDraftMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pageError, setPageError] = useState('');
  const [recoveredKeys, setRecoveredKeys] = useState(bootstrappedState.recoveredKeys);
  const [storageAvailable] = useState(bootstrappedState.storageAvailable);
  const initialNoticeShown = useRef(false);
  const persistenceWarningShown = useRef(false);

  const showToast = useCallback((toast) => {
    const id = `${toast.type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setToasts((current) => [...current, { id, ...toast }]);

    globalThis.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  useEffect(() => {
    setSessionLoading(false);

    if (initialNoticeShown.current) {
      return;
    }

    initialNoticeShown.current = true;

    if (!storageAvailable) {
      setPageError('Le stockage local du navigateur est indisponible. Lifys reste utilisable, mais vos données seront perdues après fermeture de l’onglet.');
      showToast({
        type: 'warning',
        title: 'Mode temporaire',
        message: 'Le navigateur bloque localStorage. Les données restent limitées à cette session.',
      });
      return;
    }

    if (recoveredKeys.length) {
      showToast({
        type: 'warning',
        title: 'Données locales réparées',
        message: `Les données corrompues suivantes ont été réinitialisées : ${formatRecoveredKeys(recoveredKeys)}.`,
      });
    }
  }, [recoveredKeys, showToast, storageAvailable]);

  useEffect(() => {
    if (sessionLoading || !storageAvailable) {
      return;
    }

    const writesSucceeded = [
      safeWriteJSON(STORAGE_KEYS.profile, profile),
      safeWriteJSON(STORAGE_KEYS.likes, likes),
      safeWriteJSON(STORAGE_KEYS.passed, passed),
      safeWriteJSON(STORAGE_KEYS.matches, matches),
      safeWriteJSON(STORAGE_KEYS.messages, conversations),
    ].every(Boolean);

    if (!writesSucceeded && !persistenceWarningShown.current) {
      persistenceWarningShown.current = true;
      setPageError(PERSISTENCE_ERROR_MESSAGE);
      showToast({
        type: 'warning',
        title: 'Sauvegarde locale incomplète',
        message: PERSISTENCE_ERROR_MESSAGE,
      });
    }

    if (writesSucceeded && persistenceWarningShown.current) {
      persistenceWarningShown.current = false;
      setPageError((current) => (current === PERSISTENCE_ERROR_MESSAGE ? '' : current));
    }
  }, [conversations, likes, matches, passed, profile, sessionLoading, showToast, storageAvailable]);

  useEffect(() => {
    if (!conversations.some((conversation) => conversation.id === selectedConversation)) {
      setSelectedConversation(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedConversation]);

  const selectedConversationData = conversations.find((conversation) => conversation.id === selectedConversation) ?? null;
  const totalMessageCount = useMemo(
    () => conversations.reduce((count, conversation) => count + conversation.messages.length, 0),
    [conversations],
  );
  const availableCities = useMemo(
    () => [...new Set(DEMO_PROFILES.map((item) => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [],
  );
  const filteredProfiles = useMemo(() => filterProfiles({
    profiles: DEMO_PROFILES,
    activeMode,
    likes,
    passed,
    profileMode: profile.mode,
    query: searchQuery,
    city: cityQuery,
  }), [activeMode, cityQuery, likes, passed, profile.mode, searchQuery]);
  const savedProfileSnapshot = useMemo(() => normalizeEditableProfile(profile), [profile]);
  const draftProfileSnapshot = useMemo(() => normalizeEditableProfile(profileDraft), [profileDraft]);
  const hasUnsavedProfileChanges = useMemo(() => (
    savedProfileSnapshot.name !== draftProfileSnapshot.name
    || savedProfileSnapshot.age !== draftProfileSnapshot.age
    || savedProfileSnapshot.city !== draftProfileSnapshot.city
    || savedProfileSnapshot.bio !== draftProfileSnapshot.bio
    || savedProfileSnapshot.interests !== draftProfileSnapshot.interests
    || savedProfileSnapshot.mode !== draftProfileSnapshot.mode
    || savedProfileSnapshot.avatar !== draftProfileSnapshot.avatar
  ), [draftProfileSnapshot, savedProfileSnapshot]);
  const completedProfile = Boolean(profile.name && profile.age && profile.city && profile.bio.trim().length >= 20);
  const hasActiveFilters = Boolean(searchQuery.trim() || cityQuery.trim() || activeMode !== 'all');

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

  const updateProfileField = (field, value) => {
    setProfileDraft((current) => ({ ...current, [field]: value }));
    setProfileErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const setCurrentView = (nextView) => {
    setView(nextView);
    setIsMobileNavOpen(false);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCityQuery('');
    setActiveMode('all');
  };

  const handleProfileSave = (event) => {
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
      const nextProfile = sanitizeProfile(profileDraft);
      setProfile(nextProfile);
      setProfileDraft(createProfileDraft(nextProfile));
      setProfileErrors({});
      setView('discover');
      setPageError('');
      showToast({
        type: 'success',
        title: 'Profil enregistré',
        message: 'Votre profil est stocké localement dans ce navigateur.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLike = (profileId) => {
    const targetProfile = DEMO_PROFILES.find((person) => person.id === profileId);
    if (!targetProfile) {
      return;
    }

    const nextLikes = sanitizeIdList([...likes, profileId]);
    const persistedProfile = sanitizeProfile(profile);
    setLikes(nextLikes);
    setPassed((current) => current.filter((item) => item !== profileId));
    setPageError('');

    const matched = shouldCreateMatch(targetProfile, persistedProfile);
    const existingConversation = conversations.find((conversation) => conversation.profileId === targetProfile.id);

    if (matched && !matches.some((item) => item.profileId === targetProfile.id)) {
      const nextMatch = createMatch(targetProfile, persistedProfile);
      const nextConversation = existingConversation ?? createConversation(targetProfile);

      setMatches((current) => [nextMatch, ...current]);

      if (!existingConversation) {
        setConversations((current) => [nextConversation, ...current]);
      }

      setSelectedConversation(nextConversation.id);
      showToast({
        type: 'success',
        title: 'Match local confirmé',
        message: 'Une conversation de démonstration a été ouverte dans la messagerie.',
      });
      return;
    }

    showToast({
      type: 'info',
      title: 'Like enregistré',
      message: 'Cette préférence a été conservée localement dans votre navigateur.',
    });
  };

  const handlePass = (profileId) => {
    setPassed((current) => sanitizeIdList([...current, profileId]));
    setLikes((current) => current.filter((item) => item !== profileId));
    setPageError('');
  };

  const handleSendMessage = () => {
    const text = draftMessage.trim();
    if (!text || !selectedConversationData) {
      return;
    }

    setMessageSending(true);

    try {
      const nextMessage = {
        id: `msg-${Date.now()}`,
        sender: 'me',
        text,
      };

      setConversations((current) => current.map((conversation) => (
        conversation.id === selectedConversationData.id
          ? { ...conversation, messages: [...conversation.messages, nextMessage] }
          : conversation
      )));
      setDraftMessage('');
      setPageError('');
    } finally {
      setMessageSending(false);
    }
  };

  const handleResetPrototype = () => {
    setResetting(true);

    try {
      const storageReset = storageAvailable ? resetPrototypeStorage(PROTOTYPE_STORAGE_KEYS) : true;
      const canApplyReset = storageReset || !storageAvailable;

      if (!canApplyReset) {
        setPageError(RESET_ERROR_MESSAGE);
        showToast({
          type: 'warning',
          title: 'Réinitialisation incomplète',
          message: RESET_ERROR_MESSAGE,
        });
        return;
      }

      const defaultConversations = sanitizeConversations(DEFAULT_MESSAGES);
      const resetProfile = sanitizeProfile(defaultProfile);

      setProfile(resetProfile);
      setProfileDraft(createProfileDraft(resetProfile));
      setProfileErrors({});
      setLikes([]);
      setPassed([]);
      setMatches([]);
      setConversations(defaultConversations);
      setSelectedConversation(defaultConversations[0]?.id ?? null);
      setDraftMessage('');
      setSearchQuery('');
      setCityQuery('');
      setActiveMode('all');
      setView('home');
      setRecoveredKeys([]);
      setPageError('');

      showToast({
        type: 'success',
        title: 'Prototype réinitialisé',
        message: 'Le profil, les interactions et les messages locaux ont été remis à zéro.',
      });
    } finally {
      setResetting(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="app-shell app-loading">
        <div className="content-panel loading-panel" role="status" aria-live="polite">
          <p className="eyebrow">Chargement</p>
          <h1>Lifys prépare votre prototype local…</h1>
          <p className="section-description">Lecture sécurisée des données locales et restauration des profils fictifs de démonstration.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Aller au contenu principal</a>
      <ToastRegion toasts={toasts} onDismiss={(toastId) => setToasts((current) => current.filter((item) => item.id !== toastId))} />

      <header className="topbar">
        <button type="button" className="brand-block" onClick={() => setCurrentView('home')}>
          <span className="brand-icon">❤</span>
          <span>
            <strong>Lifys</strong>
            <small>MVP local React + Vite · données simulées</small>
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
              aria-current={view === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <span className="prototype-badge">{storageAvailable ? 'Stockage local actif' : 'Mémoire de session uniquement'}</span>
          <span className="counter-badge muted">{matches.length} match{matches.length > 1 ? 's' : ''}</span>
          <button type="button" className="secondary-button" onClick={handleResetPrototype} disabled={resetting}>
            {resetting ? 'Réinitialisation…' : 'Réinitialiser'}
          </button>
        </div>
      </header>

      <main id="main-content" className="page-shell">
        <section className="local-notice" aria-label="Avertissement MVP">
          <strong>Prototype local</strong>
          <span>
            Les profils, likes, matchs et messages sont stockés uniquement dans ce navigateur. Les profils de découverte sont fictifs
            et aucune vérification d’identité réelle n’est effectuée.
          </span>
          {recoveredKeys.length ? <span>Clés réparées automatiquement : {formatRecoveredKeys(recoveredKeys)}.</span> : null}
        </section>

        {pageError ? <div className="form-alert" role="alert">{pageError}</div> : null}

        {view === 'home' && (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <span className="eyebrow">Expérience premium · locale</span>
                <h1>Une expérience Lifys sobre, chaleureuse et prête pour la démonstration.</h1>
                <p>
                  Explorez cinq catégories de rencontre dans un MVP local fiable, responsive et entièrement simulé :
                  Amical, Amoureux, Sans lendemain, Mariage et Professionnel.
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
                    <strong>{DEMO_PROFILES.length}</strong>
                    <small>fictifs et classés par catégorie</small>
                  </article>
                  <article className="metric-card">
                    <span>Matchs</span>
                    <strong>{matches.length}</strong>
                    <small>créés et conservés localement</small>
                  </article>
                  <article className="metric-card">
                    <span>Messages</span>
                    <strong>{totalMessageCount}</strong>
                    <small>visibles uniquement dans ce navigateur</small>
                  </article>
                </div>
              </div>

              <div className="hero-visual">
                <div className="mini-card large">
                  <span className="mini-label">Catégorie principale</span>
                  <h3>{getModeById(profile.mode || 'amoureux').label}</h3>
                  <p>{profile.city || 'Ville à compléter'} · {profile.age || '18+'} ans</p>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Profil</span>
                  <strong>{completedProfile ? 'Prêt à matcher' : 'À compléter'}</strong>
                  <p>{profile.name || 'Ajoutez vos informations pour améliorer les recommandations.'}</p>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Persistance</span>
                  <strong>{storageAvailable ? 'Locale' : 'Temporaire'}</strong>
                  <p>Aucune donnée sensible ou identité réelle n’est requise.</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="lifys-category-selection">
              <fieldset className="selection-group mode-grid">
                <legend id="lifys-category-selection" className="sr-only">Choix de catégorie</legend>
                {MODES.map((mode) => (
                  <label key={mode.id} className={activeMode === mode.id ? 'mode-card active' : 'mode-card'}>
                    <input
                      className="choice-input"
                      type="radio"
                      name="home-mode"
                      value={mode.id}
                      checked={activeMode === mode.id}
                      onChange={() => {
                        setActiveMode(mode.id);
                        setCurrentView('discover');
                      }}
                    />
                    <span className="mode-icon" style={{ '--mode-accent': mode.accent }}>{mode.icon}</span>
                    <strong>{mode.label}</strong>
                    <small>{mode.description}</small>
                  </label>
                ))}
              </fieldset>
            </section>
          </>
        )}

        {view === 'discover' && (
          <section className="content-panel">
            <SectionHeader
              eyebrow="Découverte"
              title="Profils recommandés"
              description="Filtrez les profils fictifs par catégorie, recherche texte et ville. Les likes et passes sont persistés localement."
              aside={(
                <div className="header-meta">
                  <span className="counter-badge" role="status">{filteredProfiles.length} profil{filteredProfiles.length > 1 ? 's' : ''}</span>
                  {hasUnsavedProfileChanges ? <span className="counter-badge muted">Sauvegardez le profil pour liker</span> : null}
                  {hasActiveFilters ? <button type="button" className="secondary-button" onClick={clearFilters}>Effacer les filtres</button> : null}
                </div>
              )}
            />

            <div className="discover-toolbar">
              <fieldset className="selection-group mode-pills">
                <legend className="sr-only">Filtre par catégorie</legend>
                <label className={activeMode === 'all' ? 'pill active' : 'pill'}>
                  <input
                    className="choice-input"
                    type="radio"
                    name="discover-mode"
                    value="all"
                    checked={activeMode === 'all'}
                    onChange={() => setActiveMode('all')}
                  />
                  Tous
                </label>
                {MODES.map((mode) => (
                  <label key={mode.id} className={activeMode === mode.id ? 'pill active' : 'pill'}>
                    <input
                      className="choice-input"
                      type="radio"
                      name="discover-mode"
                      value={mode.id}
                      checked={activeMode === mode.id}
                      onChange={() => setActiveMode(mode.id)}
                    />
                    {mode.label}
                  </label>
                ))}
              </fieldset>

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

            {filteredProfiles.length === 0 ? (
              <EmptyState
                title="Aucun profil disponible"
                description="Essayez une autre catégorie, élargissez vos filtres ou réinitialisez vos interactions locales."
                actionLabel={hasActiveFilters ? 'Effacer les filtres' : 'Réinitialiser le prototype'}
                onAction={hasActiveFilters ? clearFilters : handleResetPrototype}
              />
            ) : (
              <div className="discover-grid">
                {filteredProfiles.map((person) => (
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
                      <button
                        type="button"
                        className="pass-button"
                        onClick={() => handlePass(person.id)}
                        aria-label={`Passer le profil de ${person.name}`}
                        disabled={hasUnsavedProfileChanges}
                      >
                        Pass
                      </button>
                      <button
                        type="button"
                        className="like-button"
                        onClick={() => handleLike(person.id)}
                        aria-label={`Liker le profil de ${person.name}`}
                        disabled={hasUnsavedProfileChanges}
                      >
                        Like
                      </button>
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
              description="Chaque match de démonstration est calculé localement à partir de la catégorie, de la ville ou des centres d’intérêt communs."
            />

            {matches.length === 0 ? (
              <EmptyState title="Aucun match pour l’instant" description="Commencez par liker des profils pour créer vos premières connexions locales." actionLabel="Voir la découverte" onAction={() => setCurrentView('discover')} />
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
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        const conversation = conversations.find((item) => item.profileId === match.profileId);
                        setSelectedConversation(conversation?.id ?? null);
                        setCurrentView('messages');
                      }}
                    >
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
              <SectionHeader eyebrow="Messages" title="Conversations" description="Les échanges restent lisibles, sélectionnables et stockés localement." />

              {conversations.length === 0 ? (
                <EmptyState title="Aucune conversation" description="Un match local ouvre automatiquement un canal de discussion de démonstration." actionLabel="Trouver un match" onAction={() => setCurrentView('discover')} />
              ) : (
                <fieldset className="selection-group conversation-list">
                  <legend className="sr-only">Choisir une conversation</legend>
                  {conversations.map((conversation) => (
                    <label
                      key={conversation.id}
                      className={selectedConversation === conversation.id ? 'conversation-item active' : 'conversation-item'}
                    >
                      <input
                        className="choice-input"
                        type="radio"
                        name="conversation-selection"
                        value={conversation.id}
                        checked={selectedConversation === conversation.id}
                        onChange={() => setSelectedConversation(conversation.id)}
                      />
                      <Avatar className="conversation-avatar" src={conversation.avatar} alt={conversation.name} fallback={conversation.name} />
                      <div>
                        <strong>{conversation.name}</strong>
                        <small>{getConversationPreview(conversation)}</small>
                      </div>
                    </label>
                  ))}
                </fieldset>
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
                    {selectedConversationData.messages.map((message) => (
                      <div key={message.id} className={message.sender === 'me' ? 'bubble me' : 'bubble them'}>
                        {message.text}
                      </div>
                    ))}
                  </div>

                  <div className="composer">
                    <input
                      type="text"
                      placeholder="Écrire un message local…"
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      aria-label="Votre message"
                    />
                    <button type="button" className="primary-button" disabled={messageSending || !draftMessage.trim()} onClick={handleSendMessage}>
                      {messageSending ? 'Envoi…' : 'Envoyer'}
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState title="Sélectionnez une conversation" description="Choisissez un échange pour afficher les messages enregistrés localement." />
              )}
            </div>
          </section>
        )}

        {view === 'profile' && (
          <section className="content-panel profile-panel">
            <SectionHeader eyebrow="Profil" title="Complétez votre profil" description="Les modifications sont validées, formatées puis sauvegardées localement pour améliorer la découverte." />

            <div className="profile-layout">
              <form className="profile-form" onSubmit={handleProfileSave} noValidate>
                {Object.keys(profileErrors).length ? <div className="form-alert" role="alert">Corrigez les champs signalés avant de sauvegarder.</div> : null}

                <div className="form-grid">
                  <label>
                    <span>Prénom</span>
                    <input value={profileDraft.name} onChange={(event) => updateProfileField('name', event.target.value)} aria-invalid={Boolean(profileErrors.name)} aria-describedby={profileErrors.name ? 'profile-name-error' : undefined} />
                    {profileErrors.name ? <small id="profile-name-error" className="field-error">{profileErrors.name}</small> : null}
                  </label>
                  <label>
                    <span>Âge</span>
                    <input type="number" min="18" max="80" value={profileDraft.age ?? ''} onChange={(event) => updateProfileField('age', event.target.value)} aria-invalid={Boolean(profileErrors.age)} aria-describedby={profileErrors.age ? 'profile-age-error' : undefined} />
                    {profileErrors.age ? <small id="profile-age-error" className="field-error">{profileErrors.age}</small> : null}
                  </label>
                  <label>
                    <span>Ville</span>
                    <input value={profileDraft.city} onChange={(event) => updateProfileField('city', event.target.value)} aria-invalid={Boolean(profileErrors.city)} aria-describedby={profileErrors.city ? 'profile-city-error' : undefined} />
                    {profileErrors.city ? <small id="profile-city-error" className="field-error">{profileErrors.city}</small> : null}
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
                  <input value={profileDraft.avatar} onChange={(event) => updateProfileField('avatar', event.target.value)} aria-invalid={Boolean(profileErrors.avatar)} aria-describedby={profileErrors.avatar ? 'profile-avatar-error' : undefined} />
                  {profileErrors.avatar ? <small id="profile-avatar-error" className="field-error">{profileErrors.avatar}</small> : null}
                </label>

                <label>
                  <span>Bio</span>
                  <textarea rows="5" value={profileDraft.bio} onChange={(event) => updateProfileField('bio', event.target.value)} aria-invalid={Boolean(profileErrors.bio)} aria-describedby={profileErrors.bio ? 'profile-bio-error' : undefined} />
                  {profileErrors.bio ? <small id="profile-bio-error" className="field-error">{profileErrors.bio}</small> : null}
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
                    {profileSaving ? 'Sauvegarde…' : 'Sauvegarder le profil'}
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
                  {(profileDraft.interests
                    ? profileDraft.interests.split(',').map((item) => item.trim()).filter(Boolean)
                    : ['Ajoutez vos centres d’intérêt'])
                    .map((item, index) => (
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

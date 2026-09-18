import { useCallback, useEffect, useMemo, useState } from 'react';

import Avatar from './components/Avatar';
import ToastRegion from './components/ToastRegion';
import { DEFAULT_MESSAGES, DEMO_PROFILES, MODES, defaultProfile } from './data/demoData';
import {
  applyLikeAction,
  applyPassAction,
  appendMessageToConversation,
  ensureConversationForProfile,
  filterProfiles,
  getConversationPreview,
  getModeById,
  loadInitialState,
  sanitizeConversations,
  sanitizeIdList,
  sanitizeMatches,
  sanitizeProfile,
  serializeInterests,
} from './utils/app-utils';
import { STORAGE_KEYS, resetPrototypeStorage, safeReadJSON, safeWriteJSON } from './utils/storage';

const NAV_ITEMS = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'profile', label: 'Profil' },
];

function getInitialPrototypeState() {
  return loadInitialState({
    profile: () => safeReadJSON(STORAGE_KEYS.profile, defaultProfile, { sanitize: sanitizeProfile }),
    likes: () => safeReadJSON(STORAGE_KEYS.likes, [], { sanitize: sanitizeIdList }),
    passed: () => safeReadJSON(STORAGE_KEYS.passed, [], { sanitize: sanitizeIdList }),
    matches: () => safeReadJSON(STORAGE_KEYS.matches, [], { sanitize: sanitizeMatches }),
    messages: () => safeReadJSON(STORAGE_KEYS.messages, DEFAULT_MESSAGES, { sanitize: sanitizeConversations }),
  });
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
  const [initialState] = useState(() => getInitialPrototypeState());
  const [view, setView] = useState('home');
  const [activeMode, setActiveMode] = useState('all');
  const [profile, setProfile] = useState(initialState.profile);
  const [profileDraft, setProfileDraft] = useState({
    ...initialState.profile,
    interests: serializeInterests(initialState.profile.interests),
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [likes, setLikes] = useState(initialState.likes);
  const [passed, setPassed] = useState(initialState.passed);
  const [matches, setMatches] = useState(initialState.matches);
  const [conversations, setConversations] = useState(initialState.messages);
  const [selectedConversation, setSelectedConversation] = useState(initialState.messages[0]?.id ?? null);
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
  const [storageAvailable, setStorageAvailable] = useState(initialState.storageAvailable);

  const showToast = useCallback((toast) => {
    const id = `${toast.type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const handleStorageFailure = useCallback(() => {
    setStorageAvailable(false);
    setPageError('La sauvegarde locale du prototype est indisponible sur ce navigateur. Les données restent simulées et temporaires.');
    showToast({
      type: 'warning',
      title: 'Sauvegarde locale indisponible',
      message: 'Votre navigateur a refusé la persistance locale. Les changements restent visibles pendant cette session uniquement.',
    });
  }, [showToast]);

  const handleWriteFailure = useCallback(() => {
    setPageError('Certaines données locales n’ont pas pu être enregistrées. Réessayez ou réinitialisez le prototype.');
    showToast({
      type: 'warning',
      title: 'Écriture locale incomplète',
      message: 'Le prototype continue de fonctionner, mais une partie des changements n’a pas pu être enregistrée.',
    });
  }, [showToast]);

  useEffect(() => {
    if (initialState.recoveredKeys.length) {
      showToast({
        type: 'warning',
        title: 'Données locales réparées',
        message: `Les clés corrompues suivantes ont été réinitialisées : ${initialState.recoveredKeys.join(', ')}.`,
      });
    }

    if (!initialState.storageAvailable) {
      handleStorageFailure();
    }

    const timeoutId = window.setTimeout(() => setSessionLoading(false), 180);
    return () => window.clearTimeout(timeoutId);
  }, [handleStorageFailure, initialState, showToast]);

  useEffect(() => {
    if (!safeWriteJSON(STORAGE_KEYS.profile, profile)) {
      handleWriteFailure();
    }
  }, [handleWriteFailure, profile]);

  useEffect(() => {
    if (!safeWriteJSON(STORAGE_KEYS.likes, likes)) {
      handleWriteFailure();
    }
  }, [handleWriteFailure, likes]);

  useEffect(() => {
    if (!safeWriteJSON(STORAGE_KEYS.passed, passed)) {
      handleWriteFailure();
    }
  }, [handleWriteFailure, passed]);

  useEffect(() => {
    if (!safeWriteJSON(STORAGE_KEYS.matches, matches)) {
      handleWriteFailure();
    }
  }, [handleWriteFailure, matches]);

  useEffect(() => {
    if (!safeWriteJSON(STORAGE_KEYS.messages, conversations)) {
      handleWriteFailure();
    }
  }, [conversations, handleWriteFailure]);

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
  const completedProfile = Boolean(profile.name && profile.age && profile.city && profile.bio);
  const availableCities = useMemo(
    () => [...new Set(DEMO_PROFILES.map((item) => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [],
  );
  const visibleProfiles = useMemo(() => filterProfiles({
    profiles: DEMO_PROFILES,
    activeMode,
    likes,
    passed,
    profileMode: profile.mode,
    query: searchQuery,
    city: cityQuery,
  }), [activeMode, cityQuery, likes, passed, profile.mode, searchQuery]);

  const totalMessages = useMemo(
    () => conversations.reduce((count, conversation) => count + conversation.messages.length, 0),
    [conversations],
  );

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
  };

  const setCurrentView = (nextView) => {
    setView(nextView);
    setIsMobileNavOpen(false);
  };

  const handleProfileSave = (event) => {
    event.preventDefault();
    setProfileSaving(true);
    const errors = validateProfile();
    setProfileErrors(errors);

    if (Object.keys(errors).length) {
      showToast({
        type: 'warning',
        title: 'Profil incomplet',
        message: 'Corrigez les champs signalés avant l’enregistrement.',
      });
      setProfileSaving(false);
      return;
    }

    const nextProfile = sanitizeProfile(profileDraft);
    setProfile(nextProfile);
    setProfileDraft({
      ...nextProfile,
      interests: serializeInterests(nextProfile.interests),
    });
    setProfileErrors({});
    setPageError('');
    setView('discover');
    setProfileSaving(false);
    showToast({
      type: 'success',
      title: 'Profil enregistré',
      message: storageAvailable
        ? 'Vos préférences sont sauvegardées localement sur cet appareil.'
        : 'Vos préférences sont à jour pour cette session locale.',
    });
  };

  const handleLike = (profileId) => {
    const result = applyLikeAction({
      profileId,
      profile,
      likes,
      passed,
      matches,
      conversations,
    });

    if (!result) {
      return;
    }

    setLikes(result.likes);
    setPassed(result.passed);
    setPageError('');

    if (result.matched) {
      setMatches(result.matches);
      setConversations(result.conversations);
      setSelectedConversation(result.selectedConversationId);
      setView('matches');
      showToast({
        type: 'success',
        title: 'Match local confirmé',
        message: 'Une conversation simulée a été ouverte dans votre messagerie.',
      });
      return;
    }

    showToast({
      type: 'info',
      title: 'Like enregistré',
      message: 'Ce profil fictif a été retiré de votre découverte locale.',
    });
  };

  const handlePass = (profileId) => {
    const result = applyPassAction({
      profileId,
      likes,
      passed,
      matches,
      conversations,
    });

    setLikes(result.likes);
    setPassed(result.passed);
    setMatches(result.matches);
    setConversations(result.conversations);
    if (selectedConversationData?.profileId === profileId) {
      setSelectedConversation(result.conversations[0]?.id ?? null);
    }
    setPageError('');
    showToast({
      type: 'info',
      title: 'Profil masqué',
      message: 'Le profil ne sera plus affiché dans cette session locale.',
    });
  };

  const handleSendMessage = () => {
    if (!selectedConversationData) {
      return;
    }

    const result = appendMessageToConversation({
      conversationId: selectedConversationData.id,
      text: draftMessage,
      conversations,
      matches,
    });

    if (!result) {
      return;
    }

    setMessageSending(true);
    setConversations(result.conversations);
    setMatches(result.matches);
    setDraftMessage('');
    setPageError('');
    setMessageSending(false);
  };

  const handleResetPrototype = () => {
    const defaultMessages = sanitizeConversations(DEFAULT_MESSAGES);
    const resetProfile = { ...defaultProfile };

    setResetting(true);
    if (!resetPrototypeStorage(Object.values(STORAGE_KEYS))) {
      handleWriteFailure();
      setResetting(false);
      return;
    }
    setProfile(resetProfile);
    setProfileDraft({
      ...resetProfile,
      interests: serializeInterests(resetProfile.interests),
    });
    setProfileErrors({});
    setLikes([]);
    setPassed([]);
    setMatches([]);
    setConversations(defaultMessages);
    setSelectedConversation(defaultMessages[0]?.id ?? null);
    setSearchQuery('');
    setCityQuery('');
    setActiveMode('all');
    setDraftMessage('');
    setPageError('');
    setView('home');
    setResetting(false);

    showToast({
      type: 'success',
      title: 'Prototype réinitialisé',
      message: 'Les données locales ont été effacées et les conversations de démonstration ont été restaurées.',
    });
  };

  if (sessionLoading) {
    return (
      <div className="app-shell app-loading">
        <div className="content-panel loading-panel" role="status" aria-live="polite">
          <p className="eyebrow">Chargement</p>
          <h1>Lifys prépare votre prototype local…</h1>
          <p className="section-description">Lecture des données simulées, restauration des préférences locales et contrôle des éventuelles corruptions.</p>
        </div>
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
            <small>Prototype local React + Vite</small>
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
          <span className={storageAvailable ? 'prototype-badge' : 'counter-badge muted'}>
            {storageAvailable ? 'Sauvegarde locale active' : 'Sauvegarde temporaire'}
          </span>
          <button type="button" className="secondary-button" onClick={handleResetPrototype} disabled={resetting}>
            {resetting ? 'Réinitialisation…' : 'Réinitialiser'}
          </button>
        </div>
      </header>

      <main className="page-shell">
        <section className="local-notice" aria-label="Avertissement MVP">
          <strong>MVP local & simulé</strong>
          <span>Les profils de découverte, matchs et messages sont fictifs ou simulés dans votre navigateur. Aucune identité réelle n’est vérifiée.</span>
          <span>{storageAvailable ? 'Les données restent sur cet appareil via localStorage.' : 'Le navigateur refuse la persistance : les changements resteront visibles uniquement pendant cette session.'}</span>
        </section>

        {pageError ? <div className="form-alert" role="alert">{pageError}</div> : null}

        {view === 'home' && (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <span className="eyebrow">Expérience premium locale</span>
                <h1>Un MVP Lifys plus chaleureux, fiable et prêt à être présenté.</h1>
                <p>
                  Explorez cinq catégories — Amical, Amoureux, Sans lendemain, Mariage et Professionnel — dans
                  une expérience responsive, sobre et entièrement locale.
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
                    <strong>{visibleProfiles.length}</strong>
                    <small>correspondances visibles selon vos filtres</small>
                  </article>
                  <article className="metric-card">
                    <span>Matchs</span>
                    <strong>{matches.length}</strong>
                    <small>enregistrés localement sur cet appareil</small>
                  </article>
                  <article className="metric-card">
                    <span>Messages</span>
                    <strong>{totalMessages}</strong>
                    <small>conservés dans votre prototype local</small>
                  </article>
                </div>
              </div>

              <div className="hero-visual">
                <div className="mini-card large">
                  <span className="mini-label">Catégorie active</span>
                  <h3>{getModeById(activeMode === 'all' ? profile.mode : activeMode).label}</h3>
                  <p>{profile.city || 'Ville à compléter'} · {profile.age || '18+'} ans</p>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Profil</span>
                  <strong>{completedProfile ? 'Prêt à matcher' : 'À compléter'}</strong>
                  <p>{profile.name || 'Ajoutez votre prénom pour personnaliser le prototype.'}</p>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Positionnement</span>
                  <strong>Local & démonstratif</strong>
                  <p>Sans backend requis, sans paiement, sans vérification d’identité.</p>
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
              description="Filtrez des profils fictifs de démonstration par catégorie, texte ou ville. Les likes et passes restent locaux."
              aside={(
                <div className="header-meta">
                  <span className="counter-badge">{`${visibleProfiles.length} profil${visibleProfiles.length > 1 ? 's' : ''}`}</span>
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

            {visibleProfiles.length === 0 ? (
              <EmptyState
                title="Aucun profil disponible"
                description="Essayez une autre catégorie, élargissez vos filtres ou réinitialisez votre prototype local."
                actionLabel="Effacer les filtres"
                onAction={() => {
                  setSearchQuery('');
                  setCityQuery('');
                  setActiveMode('all');
                }}
              />
            ) : (
              <div className="discover-grid">
                {visibleProfiles.map((person) => (
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
                      <button type="button" className="pass-button" onClick={() => handlePass(person.id)} aria-label={`Passer le profil de ${person.name}`}>Pass</button>
                      <button type="button" className="like-button" onClick={() => handleLike(person.id)} aria-label={`Liker le profil de ${person.name}`}>Like</button>
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
              description="Chaque match découle d’une affinité simulée : catégorie, ville ou intérêts communs."
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
                      <small>{match.lastMessage}</small>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => {
                      const conversationState = ensureConversationForProfile({
                        profileId: match.profileId,
                        conversations,
                      });
                      if (conversationState) {
                        setConversations(conversationState.conversations);
                        setSelectedConversation(conversationState.conversation.id);
                      }
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
              <SectionHeader eyebrow="Messages" title="Conversations" description="Conversations locales persistées dans le navigateur avec envoi par Entrée." />

              {conversations.length === 0 ? (
                <EmptyState title="Aucune conversation" description="Un match local peut ouvrir automatiquement un canal de discussion simulé." actionLabel="Trouver un match" onAction={() => setCurrentView('discover')} />
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
                      <EmptyState title="Aucun message" description="Cette conversation locale est prête à démarrer." />
                    ) : selectedConversationData.messages.map((message) => (
                      <div key={message.id} className={message.sender === 'me' ? 'bubble me' : 'bubble them'}>
                        {message.text}
                      </div>
                    ))}
                  </div>

                  <div className="composer">
                    <input
                      type="text"
                      aria-label="Écrire un message"
                      placeholder="Écrire un message local…"
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
                <EmptyState title="Sélectionnez une conversation" description="Choisissez un échange pour afficher vos messages locaux." />
              )}
            </div>
          </section>
        )}

        {view === 'profile' && (
          <section className="content-panel profile-panel">
            <SectionHeader eyebrow="Profil" title="Complétez votre profil" description="Les modifications sont validées puis enregistrées localement sur cet appareil." />

            <div className="profile-layout">
              <form className="profile-form" onSubmit={handleProfileSave} noValidate>
                {Object.keys(profileErrors).length ? <div className="form-alert" role="alert">Corrigez les champs signalés avant de sauvegarder.</div> : null}

                <div className="form-grid">
                  <label>
                    <span>Prénom</span>
                    <input value={profileDraft.name} onChange={(event) => updateProfileField('name', event.target.value)} aria-invalid={Boolean(profileErrors.name)} aria-describedby={profileErrors.name ? 'profile-name-error' : undefined} />
                    {profileErrors.name ? <small className="field-error" id="profile-name-error">{profileErrors.name}</small> : null}
                  </label>
                  <label>
                    <span>Âge</span>
                    <input type="number" min="18" max="80" value={profileDraft.age ?? ''} onChange={(event) => updateProfileField('age', event.target.value)} aria-invalid={Boolean(profileErrors.age)} aria-describedby={profileErrors.age ? 'profile-age-error' : undefined} />
                    {profileErrors.age ? <small className="field-error" id="profile-age-error">{profileErrors.age}</small> : null}
                  </label>
                  <label>
                    <span>Ville</span>
                    <input value={profileDraft.city} onChange={(event) => updateProfileField('city', event.target.value)} aria-invalid={Boolean(profileErrors.city)} aria-describedby={profileErrors.city ? 'profile-city-error' : undefined} />
                    {profileErrors.city ? <small className="field-error" id="profile-city-error">{profileErrors.city}</small> : null}
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
                  {profileErrors.avatar ? <small className="field-error" id="profile-avatar-error">{profileErrors.avatar}</small> : null}
                </label>

                <label>
                  <span>Bio</span>
                  <textarea rows="5" value={profileDraft.bio} onChange={(event) => updateProfileField('bio', event.target.value)} aria-invalid={Boolean(profileErrors.bio)} aria-describedby={profileErrors.bio ? 'profile-bio-error' : undefined} />
                  {profileErrors.bio ? <small className="field-error" id="profile-bio-error">{profileErrors.bio}</small> : null}
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
                    {profileSaving ? 'Enregistrement…' : 'Sauvegarder le profil'}
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

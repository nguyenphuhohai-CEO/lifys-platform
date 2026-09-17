import { useCallback, useEffect, useMemo, useState } from 'react';

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
  const [bootState] = useState(() => loadInitialState({
    profile: () => safeReadJSON(STORAGE_KEYS.profile, defaultProfile, { sanitize: sanitizeProfile }),
    likes: () => safeReadJSON(STORAGE_KEYS.likes, [], { sanitize: sanitizeIdList }),
    passed: () => safeReadJSON(STORAGE_KEYS.passed, [], { sanitize: sanitizeIdList }),
    matches: () => safeReadJSON(STORAGE_KEYS.matches, [], { sanitize: sanitizeMatches }),
    messages: () => safeReadJSON(STORAGE_KEYS.messages, DEFAULT_MESSAGES, { sanitize: sanitizeConversations }),
  }));
  const [view, setView] = useState('home');
  const [activeMode, setActiveMode] = useState('all');
  const [profile, setProfile] = useState(bootState.profile);
  const [profileDraft, setProfileDraft] = useState(bootState.profile);
  const [profileErrors, setProfileErrors] = useState({});
  const [likes, setLikes] = useState(bootState.likes);
  const [passed, setPassed] = useState(bootState.passed);
  const [matches, setMatches] = useState(bootState.matches);
  const [messages, setMessages] = useState(bootState.messages);
  const [selectedConversation, setSelectedConversation] = useState(bootState.messages[0]?.id ?? null);
  const [draftMessage, setDraftMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const showToast = useCallback((toast) => {
    const id = `${toast.type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  useEffect(() => {
    setProfileDraft(profile);
  }, [profile]);

  useEffect(() => {
    setIsReady(true);

    if (bootState.recoveredKeys.length) {
      showToast({
        type: 'warning',
        title: 'Données locales restaurées',
        message: `Certaines données corrompues (${bootState.recoveredKeys.join(', ')}) ont été réinitialisées en toute sécurité.`,
      });
    }

    if (!bootState.storageAvailable) {
      showToast({
        type: 'warning',
        title: 'Stockage indisponible',
        message: 'Le navigateur ne permet pas la persistance locale. Le prototype reste utilisable sur la session courante.',
      });
    }
  }, [bootState.recoveredKeys, bootState.storageAvailable, showToast]);

  useEffect(() => {
    if (isReady) {
      safeWriteJSON(STORAGE_KEYS.profile, profile);
    }
  }, [isReady, profile]);

  useEffect(() => {
    if (isReady) {
      safeWriteJSON(STORAGE_KEYS.likes, likes);
    }
  }, [isReady, likes]);

  useEffect(() => {
    if (isReady) {
      safeWriteJSON(STORAGE_KEYS.passed, passed);
    }
  }, [isReady, passed]);

  useEffect(() => {
    if (isReady) {
      safeWriteJSON(STORAGE_KEYS.matches, matches);
    }
  }, [isReady, matches]);

  useEffect(() => {
    if (isReady) {
      safeWriteJSON(STORAGE_KEYS.messages, messages);
    }
  }, [isReady, messages]);

  useEffect(() => {
    if (!messages.some((conversation) => conversation.id === selectedConversation)) {
      setSelectedConversation(messages[0]?.id ?? null);
    }
  }, [messages, selectedConversation]);

  const activeProfileMode = profile.mode || defaultProfile.mode;
  const selectedConversationData = messages.find((conversation) => conversation.id === selectedConversation) ?? null;
  const visibleProfiles = useMemo(() => filterProfiles({
    profiles: DEMO_PROFILES,
    activeMode,
    likes,
    passed,
    profileMode: activeProfileMode,
    query: searchQuery,
    city: cityQuery,
  }), [activeMode, activeProfileMode, cityQuery, likes, passed, searchQuery]);
  const availableCities = useMemo(() => [...new Set(DEMO_PROFILES.map((item) => item.city))].sort((a, b) => a.localeCompare(b)), []);
  const totalProfilesForMode = useMemo(() => DEMO_PROFILES.filter((item) => activeMode === 'all' || item.mode === activeMode).length, [activeMode]);
  const seenProfiles = likes.length + passed.length;
  const completedProfile = Boolean(profile.name && profile.city && profile.bio && profile.age);

  const updateProfileField = (field, value) => {
    setProfileDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

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

  const handleProfileSave = (event) => {
    event.preventDefault();

    const errors = validateProfile();
    setProfileErrors(errors);

    if (Object.keys(errors).length) {
      showToast({
        type: 'warning',
        title: 'Profil incomplet',
        message: 'Corrigez les champs signalés pour enregistrer votre profil local.',
      });
      return;
    }

    const nextProfile = sanitizeProfile(profileDraft);
    setProfile(nextProfile);
    setProfileDraft(nextProfile);
    setProfileErrors({});
    setView('discover');
    showToast({
      type: 'success',
      title: 'Profil enregistré',
      message: 'Vos informations sont sauvegardées uniquement dans ce navigateur.',
    });
  };

  const ensureConversation = (profileTarget) => {
    const existingConversation = messages.find((item) => item.profileId === profileTarget.id);
    if (existingConversation) {
      return existingConversation.id;
    }

    const nextConversation = createConversation(profileTarget);
    setMessages((current) => [...current, nextConversation]);
    return nextConversation.id;
  };

  const handleLike = (profileId) => {
    if (likes.includes(profileId)) {
      return;
    }

    const profileTarget = DEMO_PROFILES.find((item) => item.id === profileId);
    if (!profileTarget) {
      return;
    }

    setLikes((current) => [...current, profileId]);

    if (shouldCreateMatch(profileTarget, profile)) {
      const alreadyMatched = matches.some((item) => item.profileId === profileId);
      if (!alreadyMatched) {
        const newMatch = createMatch(profileTarget, profile);
        setMatches((current) => [...current, newMatch]);
        ensureConversation(profileTarget);
        showToast({
          type: 'success',
          title: `Nouveau match avec ${profileTarget.name}`,
          message: 'La conversation locale est prête dans l’onglet Messages.',
        });
      }
      return;
    }

    showToast({
      type: 'info',
      title: 'Like enregistré',
      message: `${profileTarget.name} a été ajouté à vos affinités locales.`,
    });
  };

  const handlePass = (profileId) => {
    if (passed.includes(profileId)) {
      return;
    }

    setPassed((current) => [...current, profileId]);
  };

  const handleOpenMatch = (match) => {
    const profileTarget = DEMO_PROFILES.find((item) => item.id === match.profileId) ?? match;
    const conversationId = ensureConversation(profileTarget);
    setSelectedConversation(conversationId);
    setView('messages');
  };

  const handleSendMessage = () => {
    const trimmedMessage = draftMessage.trim();
    if (!trimmedMessage || !selectedConversationData) {
      return;
    }

    const nextMessage = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: trimmedMessage,
    };

    setMessages((current) => current.map((item) => (
      item.id === selectedConversationData.id
        ? { ...item, messages: [...item.messages, nextMessage] }
        : item
    )));
    setDraftMessage('');
  };

  const handleResetPrototype = () => {
    resetPrototypeStorage();
    const sanitizedDefaults = sanitizeConversations(DEFAULT_MESSAGES);
    setProfile(defaultProfile);
    setProfileDraft(defaultProfile);
    setProfileErrors({});
    setLikes([]);
    setPassed([]);
    setMatches([]);
    setMessages(sanitizedDefaults);
    setSelectedConversation(sanitizedDefaults[0]?.id ?? null);
    setDraftMessage('');
    setSearchQuery('');
    setCityQuery('');
    setActiveMode('all');
    setView('home');
    showToast({
      type: 'success',
      title: 'Prototype réinitialisé',
      message: 'Toutes les données locales ont été effacées et les profils de démonstration ont été restaurés.',
    });
  };

  const setCurrentView = (nextView) => {
    setView(nextView);
    setIsMobileNavOpen(false);
  };

  if (!isReady) {
    return (
      <div className="app-shell app-loading">
        <div className="content-panel loading-panel" role="status" aria-live="polite">
          <p className="eyebrow">Chargement</p>
          <h1>Lifys prépare votre prototype local…</h1>
          <p className="section-description">Initialisation sécurisée des profils, matchs et conversations stockés dans le navigateur.</p>
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
            <small>Prototype premium, local et simulé</small>
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
          <span className="prototype-badge">Données 100% locales</span>
          <button type="button" className="secondary-button" onClick={handleResetPrototype}>
            Réinitialiser
          </button>
        </div>
      </header>

      <main className="page-shell">
        <section className="local-notice" aria-label="Avertissement prototype">
          <strong>Prototype local</strong>
          <span>Profils, matchs et messages sont fictifs, enregistrés uniquement dans votre navigateur et ne constituent ni backend réel, ni identité vérifiée.</span>
        </section>

        {view === 'home' && (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <span className="eyebrow">Expérience premium · responsive · locale</span>
                <h1>Cinq façons de créer une rencontre, une seule expérience Lifys.</h1>
                <p>
                  Explorez des connexions amicales, amoureuses, sans lendemain, orientées mariage ou professionnelles dans un MVP chaleureux,
                  sobre et prêt à évoluer sans changer inutilement la stack React + Vite.
                </p>

                <div className="cta-row">
                  <button type="button" className="primary-button" onClick={() => setCurrentView('discover')}>Découvrir les profils</button>
                  <button type="button" className="secondary-button" onClick={() => setCurrentView('profile')}>
                    {completedProfile ? 'Modifier mon profil' : 'Créer mon profil'}
                  </button>
                </div>

                <div className="hero-metrics" aria-label="Résumé du prototype">
                  <article className="metric-card">
                    <span>Profils visibles</span>
                    <strong>{visibleProfiles.length}</strong>
                    <small>sur {totalProfilesForMode}</small>
                  </article>
                  <article className="metric-card">
                    <span>Matchs locaux</span>
                    <strong>{matches.length}</strong>
                    <small>générés dans le navigateur</small>
                  </article>
                  <article className="metric-card">
                    <span>Progression profil</span>
                    <strong>{completedProfile ? 'Complet' : 'À finaliser'}</strong>
                    <small>{completedProfile ? 'Prêt pour la découverte' : 'Nom, âge, ville, bio requis'}</small>
                  </article>
                </div>
              </div>

              <div className="hero-visual">
                <div className="mini-card large">
                  <span className="mini-label">Catégorie principale</span>
                  <h3>{getModeById(activeProfileMode).label}</h3>
                  <p>{profile.city || 'Ville non renseignée'} · {profile.age || '18+'} ans</p>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Découverte</span>
                  <strong>{seenProfiles}</strong>
                  <p>profils déjà consultés</p>
                </div>
                <div className="mini-card">
                  <span className="mini-label">Conversations</span>
                  <strong>{messages.length}</strong>
                  <p>fils locaux disponibles</p>
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
              description="Filtrez par catégorie, texte ou ville. Les résultats tiennent compte de vos likes, passes et du mode principal de votre profil."
              aside={(
                <div className="header-meta">
                  <span className="counter-badge">{visibleProfiles.length} profil{visibleProfiles.length > 1 ? 's' : ''} visible{visibleProfiles.length > 1 ? 's' : ''}</span>
                  <span className="counter-badge muted">{seenProfiles} déjà traités</span>
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
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Nom, bio, intérêt…"
                  />
                </label>
                <label>
                  <span>Ville</span>
                  <input
                    type="search"
                    list="lifys-cities"
                    value={cityQuery}
                    onChange={(event) => setCityQuery(event.target.value)}
                    placeholder="Paris, Lyon…"
                  />
                  <datalist id="lifys-cities">
                    {availableCities.map((city) => <option key={city} value={city} />)}
                  </datalist>
                </label>
              </div>
            </div>

            {visibleProfiles.length === 0 ? (
              <EmptyState
                title="Aucun profil ne correspond à vos critères"
                description="Essayez une autre catégorie, effacez vos filtres ou réinitialisez les données locales pour revoir tous les profils de démonstration."
                actionLabel="Effacer les filtres"
                onAction={() => {
                  setSearchQuery('');
                  setCityQuery('');
                  setActiveMode('all');
                }}
              />
            ) : (
              <div className="discover-grid">
                {visibleProfiles.slice(0, 6).map((person) => (
                  <article key={person.id} className="profile-card">
                    <Avatar className="profile-avatar" src={person.avatar} alt={person.name} fallback={person.name} />
                    <div className="profile-card-body">
                      <div className="identity-row">
                        <div>
                          <h3>{person.name}, {person.age}</h3>
                          <p className="city-line">📍 {person.city}</p>
                        </div>
                        <span className="tag">{getModeById(person.mode).label}</span>
                      </div>
                      <p>{person.bio}</p>
                      <div className="interest-row">
                        {person.interests.map((item) => (
                          <span key={`${person.id}-${item}`}>{item}</span>
                        ))}
                      </div>
                    </div>
                    <div className="card-actions">
                      <button type="button" className="pass-button" aria-label={`Passer le profil de ${person.name}`} onClick={() => handlePass(person.id)}>
                        Pass
                      </button>
                      <button type="button" className="like-button" aria-label={`Liker le profil de ${person.name}`} onClick={() => handleLike(person.id)}>
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
              description="Chaque match reste local à ce navigateur. Utilisez la messagerie de démonstration pour visualiser l’expérience conversationnelle."
            />

            {matches.length === 0 ? (
              <EmptyState
                title="Aucun match pour l’instant"
                description="Complétez votre profil puis likez des profils compatibles pour déclencher des correspondances locales."
                actionLabel="Compléter mon profil"
                onAction={() => setCurrentView('profile')}
              />
            ) : (
              <div className="matches-list">
                {matches.map((match) => (
                  <article key={match.id} className="match-item">
                    <Avatar className="match-avatar" src={match.avatar} alt={match.name} fallback={match.name} />
                    <div className="match-copy">
                      <h3>{match.name}</h3>
                      <p>{match.city} · {getModeById(match.mode).label}</p>
                      <small>{match.reason}</small>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => handleOpenMatch(match)}>
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
              <SectionHeader
                eyebrow="Messages"
                title="Conversations"
                description="Sélectionnez un échange pour consulter l’historique local ou envoyer un nouveau message avec la touche Entrée."
              />

              {messages.length === 0 ? (
                <EmptyState
                  title="Aucune conversation"
                  description="Créez d’abord un match local pour déverrouiller la messagerie de démonstration."
                  actionLabel="Voir les profils"
                  onAction={() => setCurrentView('discover')}
                />
              ) : (
                <div className="conversation-list">
                  {messages.map((conversation) => (
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
                    />
                    <button type="button" className="primary-button" onClick={handleSendMessage} disabled={!draftMessage.trim()}>
                      Envoyer
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Sélectionnez une conversation"
                  description="Choisissez un échange dans la colonne de gauche pour afficher les messages du prototype local."
                />
              )}
            </div>
          </section>
        )}

        {view === 'profile' && (
          <section className="content-panel profile-panel">
            <SectionHeader
              eyebrow="Profil"
              title="Complétez votre profil"
              description="La validation est locale et accessible. Vos centres d’intérêt sont normalisés automatiquement pour améliorer le matching du prototype."
            />

            <div className="profile-layout">
              <form className="profile-form" onSubmit={handleProfileSave} noValidate>
                {Object.keys(profileErrors).length ? (
                  <div className="form-alert" role="alert">
                    Merci de corriger les champs indiqués avant l’enregistrement.
                  </div>
                ) : null}

                <div className="form-grid">
                  <label>
                    <span>Prénom</span>
                    <input
                      name="name"
                      value={profileDraft.name}
                      onChange={(event) => updateProfileField('name', event.target.value)}
                      placeholder="Sofia"
                      aria-invalid={Boolean(profileErrors.name)}
                    />
                    {profileErrors.name ? <small className="field-error">{profileErrors.name}</small> : null}
                  </label>
                  <label>
                    <span>Âge</span>
                    <input
                      name="age"
                      type="number"
                      min="18"
                      max="80"
                      value={profileDraft.age}
                      onChange={(event) => updateProfileField('age', event.target.value)}
                      aria-invalid={Boolean(profileErrors.age)}
                    />
                    {profileErrors.age ? <small className="field-error">{profileErrors.age}</small> : null}
                  </label>
                  <label>
                    <span>Ville</span>
                    <input
                      name="city"
                      value={profileDraft.city}
                      onChange={(event) => updateProfileField('city', event.target.value)}
                      placeholder="Paris"
                      aria-invalid={Boolean(profileErrors.city)}
                    />
                    {profileErrors.city ? <small className="field-error">{profileErrors.city}</small> : null}
                  </label>
                  <label>
                    <span>Catégorie principale</span>
                    <select
                      name="mode"
                      value={profileDraft.mode}
                      onChange={(event) => updateProfileField('mode', event.target.value)}
                    >
                      {MODES.map((mode) => (
                        <option key={mode.id} value={mode.id}>{mode.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  <span>Avatar URL</span>
                  <input
                    name="avatar"
                    value={profileDraft.avatar}
                    onChange={(event) => updateProfileField('avatar', event.target.value)}
                    placeholder="https://..."
                    aria-invalid={Boolean(profileErrors.avatar)}
                  />
                  {profileErrors.avatar ? <small className="field-error">{profileErrors.avatar}</small> : null}
                </label>

                <label>
                  <span>Bio</span>
                  <textarea
                    name="bio"
                    rows="5"
                    value={profileDraft.bio}
                    onChange={(event) => updateProfileField('bio', event.target.value)}
                    placeholder="Décrivez votre personnalité, vos attentes et l’énergie que vous souhaitez créer."
                    aria-invalid={Boolean(profileErrors.bio)}
                  />
                  {profileErrors.bio ? <small className="field-error">{profileErrors.bio}</small> : null}
                </label>

                <label>
                  <span>Centres d’intérêt</span>
                  <input
                    name="interests"
                    value={profileDraft.interests}
                    onChange={(event) => updateProfileField('interests', event.target.value)}
                    onBlur={(event) => updateProfileField('interests', serializeInterests(event.target.value))}
                    placeholder="Voyage, Musique, Sport"
                  />
                </label>

                <div className="form-actions">
                  <button type="submit" className="primary-button">Sauvegarder le profil</button>
                </div>
              </form>

              <aside className="profile-preview">
                <p className="eyebrow">Aperçu</p>
                <Avatar className="profile-preview-avatar" src={profileDraft.avatar} alt={profileDraft.name || 'Votre profil'} fallback={profileDraft.name || 'Lifys'} />
                <h3>{profileDraft.name || 'Votre prénom'}</h3>
                <p>{profileDraft.city || 'Ville'} · {profileDraft.age || '18+'} ans</p>
                <span className="tag">{getModeById(profileDraft.mode).label}</span>
                <p className="profile-preview-bio">{profileDraft.bio || 'Votre bio apparaîtra ici une fois renseignée.'}</p>
                <div className="interest-row">
                  {(profileDraft.interests ? profileDraft.interests.split(',').map((item) => item.trim()).filter(Boolean) : ['Ajoutez vos centres d’intérêt']).map((item) => (
                    <span key={item}>{item}</span>
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

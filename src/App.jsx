import { useEffect, useMemo, useRef, useState } from 'react';
import { getInitials } from './utils/format';
import { filterProfiles, shouldCreateMatch } from './utils/matching';
import { normalizeProfileDraft } from './utils/profile';
import { resetPrototypeStorage, safeReadJSON, safeWriteJSON } from './utils/storage';

const MODES = [
  { id: 'amical', label: 'Amical', icon: '💙' },
  { id: 'amoureux', label: 'Amoureux', icon: '💜' },
  { id: 'sans-lendemain', label: 'Sans lendemain', icon: '🔥' },
  { id: 'mariage', label: 'Mariage', icon: '💍' },
  { id: 'professionnel', label: 'Professionnel', icon: '💼' },
];

const DEMO_PROFILES = [
  { id: 'p1', name: 'Mila', age: 28, city: 'Paris', bio: 'Passionnée par les balades nocturnes et les bons plans culturels.', interests: ['cinéma', 'voyage', 'sport'], mode: 'amoureux', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80' },
  { id: 'p2', name: 'Lucas', age: 31, city: 'Lyon', bio: 'Tombé amoureux de la cuisine italienne et des conversations profondes.', interests: ['cuisine', 'musique', 'lecture'], mode: 'amoureux', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80' },
  { id: 'p3', name: 'Nora', age: 26, city: 'Paris', bio: 'Je cherche des rencontres joyeuses et des aventures spontanées.', interests: ['danse', 'art', 'soirées'], mode: 'sans-lendemain', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80' },
  { id: 'p4', name: 'Yanis', age: 34, city: 'Marseille', bio: 'Fan de roadtrip, cafés insolites et sorties en groupe.', interests: ['roadtrip', 'café', 'sport'], mode: 'amical', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80' },
  { id: 'p5', name: 'Sophie', age: 29, city: 'Paris', bio: 'Je veux rencontrer quelqu’un pour construire une vie pleine de sens.', interests: ['famille', 'nature', 'yoga'], mode: 'mariage', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80' },
  { id: 'p6', name: 'Omar', age: 37, city: 'Lille', bio: 'Product designer, amateur de projets ambitieux et d’échanges inspirants.', interests: ['design', 'startups', 'marketing'], mode: 'professionnel', avatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80' },
  { id: 'p7', name: 'Claire', age: 27, city: 'Bordeaux', bio: 'Amatrice d’apéros, de musique live et de rencontres authentiques.', interests: ['musique', 'café', 'voyage'], mode: 'amical', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80' },
  { id: 'p8', name: 'Theo', age: 32, city: 'Paris', bio: 'Entretiens des projets de vie simples et un goût prononcé pour la culture.', interests: ['lecture', 'nature', 'art'], mode: 'mariage', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80' },
  { id: 'p9', name: 'Léa', age: 30, city: 'Nantes', bio: 'Consultante, curieuse, drôle et ouverte à des rencontres profondes.', interests: ['travail', 'sport', 'cinéma'], mode: 'professionnel', avatar: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80' },
  { id: 'p10', name: 'Hugo', age: 25, city: 'Paris', bio: 'J’aime les soirées spontanées, les bonnes discussions et la joie de vivre.', interests: ['danse', 'nuit', 'amis'], mode: 'sans-lendemain', avatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80' }
];

const DEFAULT_MESSAGES = [
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
    ]
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
    ]
  }
];

const STORAGE_KEYS = {
  profile: 'lifys-profile',
  likes: 'lifys-likes',
  matches: 'lifys-matches',
  messages: 'lifys-messages',
  passed: 'lifys-passed',
};

const DEFAULT_PROFILE = {
  name: '',
  age: '',
  city: '',
  bio: '',
  interests: '',
  mode: 'amoureux',
  avatar: '',
};

const VIEW_ITEMS = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'profile', label: 'Profil' },
];

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isMessagesShape(value) {
  return Array.isArray(value) && value.every((conversation) =>
    conversation
    && typeof conversation.id === 'string'
    && typeof conversation.name === 'string'
    && Array.isArray(conversation.messages)
    && conversation.messages.every((message) =>
      message
      && typeof message.id === 'string'
      && (message.sender === 'me' || message.sender === 'them')
      && typeof message.text === 'string'
    )
  );
}

function isStoredProfileShape(value) {
  if (!value || typeof value !== 'object') return false;
  const hasValidName = typeof value.name === 'string';
  const hasValidCity = typeof value.city === 'string';
  const hasValidBio = typeof value.bio === 'string';
  const hasValidInterests = typeof value.interests === 'string';
  const hasValidMode = typeof value.mode === 'string';
  const hasValidAvatar = typeof value.avatar === 'string';
  const hasValidAge = value.age === '' || typeof value.age === 'number' || typeof value.age === 'string';

  return hasValidName
    && hasValidCity
    && hasValidBio
    && hasValidInterests
    && hasValidMode
    && hasValidAvatar
    && hasValidAge;
}

function modeLabel(modeId) {
  return MODES.find((mode) => mode.id === modeId)?.label || 'Amoureux';
}

function Avatar({ src, name, className }) {
  const [hasError, setHasError] = useState(!src);
  useEffect(() => {
    setHasError(!src);
  }, [src]);

  if (hasError) {
    return <div className={`avatar-fallback ${className}`}>{getInitials(name)}</div>;
  }

  return <img className={className} src={src} alt={name} onError={() => setHasError(true)} />;
}

function App() {
  const [view, setView] = useState('home');
  const [activeMode, setActiveMode] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [profileErrors, setProfileErrors] = useState({});
  const [draftMessage, setDraftMessage] = useState('');

  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [profileForm, setProfileForm] = useState(DEFAULT_PROFILE);
  const [likes, setLikes] = useState([]);
  const [passed, setPassed] = useState([]);
  const [matches, setMatches] = useState([]);
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [selectedConversation, setSelectedConversation] = useState(DEFAULT_MESSAGES[0]?.id || null);
  const notificationTimeoutsRef = useRef([]);
  const [isCompactNav, setIsCompactNav] = useState(false);

  const pushNotification = (text, type = 'info') => {
    const id = `n-${Date.now()}-${Math.random()}`;
    setNotifications((current) => [...current, { id, text, type }]);
    const timeoutId = window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== id));
      notificationTimeoutsRef.current = notificationTimeoutsRef.current.filter((savedId) => savedId !== timeoutId);
    }, 3500);
    notificationTimeoutsRef.current.push(timeoutId);
  };

  useEffect(() => () => {
    notificationTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const applyMode = () => setIsCompactNav(mediaQuery.matches);
    applyMode();
    mediaQuery.addEventListener('change', applyMode);
    return () => mediaQuery.removeEventListener('change', applyMode);
  }, []);

  useEffect(() => {
    setIsBooting(true);
    setStorageError('');
    const bootTimer = window.setTimeout(() => {
      let hasNotifiedRecovery = false;
      const notifyStorageFallback = (key) => {
        setStorageError('Certaines données locales étaient corrompues et ont été réinitialisées.');
        if (hasNotifiedRecovery) return;
        hasNotifiedRecovery = true;
        pushNotification(`Données locales réinitialisées (format invalide détecté : ${key}).`, 'warning');
      };

      const bootConfig = [
        ['profile', DEFAULT_PROFILE, isStoredProfileShape],
        ['likes', [], isStringArray],
        ['passed', [], isStringArray],
        ['matches', [], Array.isArray],
        ['messages', DEFAULT_MESSAGES, isMessagesShape],
      ];

      const [profileFromStorage, likesFromStorage, passedFromStorage, matchesFromStorage, messagesFromStorage] = bootConfig
        .map(([key, fallbackValue, validate]) => safeReadJSON(STORAGE_KEYS[key], fallbackValue, {
          validate,
          onError: notifyStorageFallback,
        }));

      setProfile({ ...DEFAULT_PROFILE, ...profileFromStorage });
      setProfileForm({ ...DEFAULT_PROFILE, ...profileFromStorage });
      setLikes(likesFromStorage);
      setPassed(passedFromStorage);
      setMatches(matchesFromStorage);
      setMessages(messagesFromStorage);
      setSelectedConversation(messagesFromStorage[0]?.id || null);
      setIsBooting(false);
    }, 220);

    return () => window.clearTimeout(bootTimer);
  }, []);

  useEffect(() => {
    if (isBooting) return;
    if (!safeWriteJSON(STORAGE_KEYS.profile, profile)) {
      setStorageError('Impossible d’écrire certaines données locales.');
      pushNotification('Impossible d’enregistrer votre profil localement.', 'error');
    }
  }, [profile, isBooting]);

  useEffect(() => {
    if (isBooting) return;
    if (!safeWriteJSON(STORAGE_KEYS.likes, likes)) {
      setStorageError('Impossible d’écrire certaines données locales.');
      pushNotification('Impossible d’enregistrer les likes localement.', 'error');
    }
  }, [likes, isBooting]);

  useEffect(() => {
    if (isBooting) return;
    if (!safeWriteJSON(STORAGE_KEYS.passed, passed)) {
      setStorageError('Impossible d’écrire certaines données locales.');
      pushNotification('Impossible d’enregistrer les profils passés.', 'error');
    }
  }, [passed, isBooting]);

  useEffect(() => {
    if (isBooting) return;
    if (!safeWriteJSON(STORAGE_KEYS.matches, matches)) {
      setStorageError('Impossible d’écrire certaines données locales.');
      pushNotification('Impossible d’enregistrer les matchs localement.', 'error');
    }
  }, [matches, isBooting]);

  useEffect(() => {
    if (isBooting) return;
    if (!safeWriteJSON(STORAGE_KEYS.messages, messages)) {
      setStorageError('Impossible d’écrire certaines données locales.');
      pushNotification('Impossible d’enregistrer les messages localement.', 'error');
    }
  }, [messages, isBooting]);

  useEffect(() => {
    if (view !== 'discover') return;
    setDiscoverLoading(true);
    const timer = window.setTimeout(() => setDiscoverLoading(false), 180);
    return () => window.clearTimeout(timer);
  }, [view, activeMode, searchText, cityFilter, likes, passed, profile.mode]);

  const filteredProfiles = useMemo(() => {
    const profileMode = profile.mode || 'all';
    return filterProfiles(DEMO_PROFILES, {
      activeMode,
      profileMode,
      likes,
      passed,
      searchText,
      cityFilter,
    });
  }, [activeMode, profile.mode, likes, passed, searchText, cityFilter]);

  const selectedConversationData = messages.find((item) => item.id === selectedConversation) || null;

  const handleProfileFieldChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((current) => ({ ...current, [name]: value }));
  };

  const handleProfileSave = (event) => {
    event.preventDefault();
    const { profile: nextProfile, errors } = normalizeProfileDraft(profileForm);

    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) {
      pushNotification('Le profil contient des erreurs. Vérifiez les champs.', 'warning');
      return;
    }

    setProfile(nextProfile);
    setProfileForm(nextProfile);
    setView('discover');
    pushNotification('Profil sauvegardé localement.', 'success');
  };

  const handleLike = (profileId) => {
    if (likes.includes(profileId)) return;
    setLikes((current) => [...current, profileId]);

    const profileTarget = DEMO_PROFILES.find((item) => item.id === profileId);
    if (!profileTarget) return;

    if (shouldCreateMatch(profileTarget, profile)) {
      setMatches((current) => {
        const exists = current.some((match) => match.profileId === profileId);
        if (exists) return current;

        pushNotification(`Nouveau match avec ${profileTarget.name} !`, 'success');
        return [
          ...current,
          {
            id: `match-${profileId}`,
            profileId,
            name: profileTarget.name,
            city: profileTarget.city,
            mode: profileTarget.mode,
            avatar: profileTarget.avatar,
            lastMessage: 'Vous avez un nouveau match ✨',
          }
        ];
      });
    }
  };

  const handlePass = (profileId) => {
    if (passed.includes(profileId)) return;
    setPassed((current) => [...current, profileId]);
  };

  const ensureConversation = (matchProfile) => {
    setView('messages');
    setMessages((current) => {
      const existing = current.find((item) => item.profileId === matchProfile.profileId);
      if (existing) {
        setSelectedConversation(existing.id);
        return current;
      }

      const newConversation = {
        id: `conv-${matchProfile.profileId}`,
        profileId: matchProfile.profileId,
        name: matchProfile.name,
        mode: matchProfile.mode,
        avatar: matchProfile.avatar,
        messages: [{ id: `intro-${Date.now()}`, sender: 'them', text: 'Heureux(se) de matcher avec toi ! 👋' }],
      };
      setSelectedConversation(newConversation.id);
      return [newConversation, ...current];
    });
  };

  const handleSendMessage = () => {
    if (!draftMessage.trim() || !selectedConversationData) return;

    const cleanMessage = draftMessage.trim();
    setMessages((current) => current.map((item) => (
      item.id === selectedConversationData.id
        ? {
          ...item,
          messages: [...item.messages, { id: `msg-${Date.now()}`, sender: 'me', text: cleanMessage }],
        }
        : item
    )));
    setDraftMessage('');
  };

  const handleResetPrototype = () => {
    resetPrototypeStorage(Object.values(STORAGE_KEYS));
    setStorageError('');
    setProfile(DEFAULT_PROFILE);
    setProfileForm(DEFAULT_PROFILE);
    setLikes([]);
    setPassed([]);
    setMatches([]);
    setMessages(DEFAULT_MESSAGES);
    setSelectedConversation(DEFAULT_MESSAGES[0]?.id || null);
    setSearchText('');
    setCityFilter('');
    setActiveMode('all');
    pushNotification('Prototype réinitialisé. Toutes les données locales ont été effacées.', 'warning');
  };

  return (
    <div className="app-shell">
      <div className="notifications" aria-live="polite" aria-atomic="true">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`notice ${notification.type}`}
            role={notification.type === 'error' ? 'alert' : 'status'}
          >
            {notification.text}
          </div>
        ))}
      </div>

      <header className="topbar">
        <button type="button" className="brand-block" onClick={() => setView('home')}>
          <span className="brand-icon">❤</span>
          <span>
            <strong>Lifys</strong>
            <small>Rencontres premium · prototype local</small>
          </span>
        </button>

        <button
          type="button"
          className="menu-button"
          aria-expanded={isMenuOpen}
          aria-controls="main-nav"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          Menu
        </button>

        <nav
          id="main-nav"
          className={`nav ${isMenuOpen ? 'open' : ''}`}
          aria-label="Navigation principale"
          aria-hidden={isCompactNav && !isMenuOpen}
          hidden={isCompactNav && !isMenuOpen}
        >
          {VIEW_ITEMS.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'nav-button active' : 'nav-button'}
              onClick={() => {
                setView(item.id);
                setIsMenuOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="page-shell">
        <section className="local-banner" role="status">
          <p>
            Données 100% locales et simulées pour ce MVP (navigateur/localStorage). Aucun backend, paiement, ni vérification d’identité réelle.
          </p>
          <button type="button" className="secondary-button" onClick={handleResetPrototype}>Réinitialiser le prototype</button>
        </section>

        {view === 'home' && (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <span className="eyebrow">Prototype professionnel</span>
                <h1>Cinq catégories, une expérience élégante et chaleureuse.</h1>
                <p>
                  Explorez des profils fictifs en mode Amical, Amoureux, Sans lendemain, Mariage ou Professionnel avec une UX locale fiable et responsive.
                </p>
                <div className="cta-row">
                  <button className="primary-button" onClick={() => setView('discover')}>Découvrir</button>
                  <button className="secondary-button" onClick={() => setView('profile')}>Compléter mon profil</button>
                </div>
              </div>
              <div className="hero-visual">
                <div className="mini-card large">
                  <span className="mini-label">Mode actif</span>
                  <h3>{modeLabel(profile.mode)}</h3>
                  <p>{profile.city || 'Ville à définir'} · {profile.age || 'Âge non renseigné'}</p>
                </div>
                <div className="mini-card small">
                  <span>Matchs</span>
                  <strong>{matches.length}</strong>
                </div>
              </div>
            </section>

            <section className="mode-grid" aria-label="Sélecteur de catégorie">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={activeMode === mode.id ? 'mode-card active' : 'mode-card'}
                  onClick={() => {
                    setActiveMode(mode.id);
                    setView('discover');
                  }}
                >
                  <span className="mode-icon">{mode.icon}</span>
                  <strong>{mode.label}</strong>
                  <small>Rencontres {mode.label.toLowerCase()}</small>
                </button>
              ))}
            </section>
          </>
        )}

        {view === 'discover' && (
          <section className="content-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Découverte</p>
                <h2>Profils recommandés</h2>
                <p className="subtle">{filteredProfiles.length} profil{filteredProfiles.length > 1 ? 's' : ''} disponibles</p>
              </div>
              <div className="mode-pills" aria-label="Filtre de mode">
                <button className={activeMode === 'all' ? 'pill active' : 'pill'} onClick={() => setActiveMode('all')}>Tous</button>
                {MODES.map((mode) => (
                  <button key={mode.id} className={activeMode === mode.id ? 'pill active' : 'pill'} onClick={() => setActiveMode(mode.id)}>{mode.label}</button>
                ))}
              </div>
            </div>

            <div className="filters-row">
              <label>
                <span>Recherche</span>
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Nom, bio, intérêts..."
                />
              </label>
              <label>
                <span>Ville</span>
                <input
                  type="text"
                  value={cityFilter}
                  onChange={(event) => setCityFilter(event.target.value)}
                  placeholder="Paris"
                />
              </label>
            </div>

            {isBooting || discoverLoading ? <div className="loading-state">Chargement des profils...</div> : null}
            {storageError ? <div className="error-state">{storageError}</div> : null}

            {!discoverLoading && !storageError && filteredProfiles.length === 0 ? (
              <div className="empty-state">
                <h3>Aucun profil ne correspond à ces filtres</h3>
                <p>Essayez une autre catégorie, retirez un filtre ou réinitialisez les données du prototype.</p>
              </div>
            ) : null}

            {!discoverLoading && !storageError && filteredProfiles.length > 0 ? (
              <div className="discover-grid">
                {filteredProfiles.slice(0, 6).map((person) => (
                  <article key={person.id} className="profile-card">
                    <Avatar src={person.avatar} name={person.name} className="card-avatar" />
                    <div className="profile-card-body">
                      <div className="identity-row">
                        <h3>{person.name}, {person.age}</h3>
                        <span className="tag">{modeLabel(person.mode)}</span>
                      </div>
                      <p className="city-line">📍 {person.city}</p>
                      <p>{person.bio}</p>
                      <div className="interest-row">
                        {person.interests.map((item) => (
                          <span key={`${person.id}-${item}`}>{item}</span>
                        ))}
                      </div>
                    </div>
                    <div className="card-actions">
                      <button className="pass-button" onClick={() => handlePass(person.id)} aria-label={`Passer le profil de ${person.name}`}>Pass</button>
                      <button className="like-button" onClick={() => handleLike(person.id)} aria-label={`Liker le profil de ${person.name}`}>Like</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        )}

        {view === 'matches' && (
          <section className="content-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Matchs</p>
                <h2>Vos correspondances</h2>
                <p className="subtle">{matches.length} match{matches.length > 1 ? 's' : ''}</p>
              </div>
            </div>

            {matches.length === 0 ? (
              <div className="empty-state">
                <h3>Aucun match pour le moment</h3>
                <p>Likez des profils compatibles pour démarrer une conversation.</p>
              </div>
            ) : (
              <div className="matches-list">
                {matches.map((match) => (
                  <article key={match.id} className="match-item">
                    <Avatar src={match.avatar} name={match.name} className="match-avatar" />
                    <div>
                      <h3>{match.name}</h3>
                      <p>{match.city} · {modeLabel(match.mode)}</p>
                      <small>{match.lastMessage}</small>
                    </div>
                    <button className="secondary-button" onClick={() => ensureConversation(match)}>Ouvrir la messagerie</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'messages' && (
          <section className="messages-layout content-panel">
            <aside className="conversation-list" aria-label="Conversations">
              {messages.length === 0 ? (
                <div className="empty-state compact">
                  <h3>Aucune conversation</h3>
                  <p>Vos discussions apparaîtront ici après un match.</p>
                </div>
              ) : (
                messages.map((conversation) => (
                  <button
                    key={conversation.id}
                    className={selectedConversation === conversation.id ? 'conversation-item active' : 'conversation-item'}
                    onClick={() => setSelectedConversation(conversation.id)}
                  >
                    <Avatar src={conversation.avatar} name={conversation.name} className="conversation-avatar" />
                    <div>
                      <strong>{conversation.name}</strong>
                      <small>{conversation.messages[conversation.messages.length - 1]?.text || 'Aucun message'}</small>
                    </div>
                  </button>
                ))
              )}
            </aside>

            <div className="chat-panel">
              {messages.length === 0 ? (
                <div className="empty-state">
                  <h3>Aucune conversation</h3>
                  <p>Vos discussions apparaîtront ici après un match.</p>
                </div>
              ) : !selectedConversationData ? (
                <div className="empty-state">
                  <h3>Sélectionnez une conversation</h3>
                </div>
              ) : (
                <>
                  <div className="chat-header">
                    <Avatar src={selectedConversationData.avatar} name={selectedConversationData.name} className="chat-avatar" />
                    <div>
                      <strong>{selectedConversationData.name}</strong>
                      <small>{modeLabel(selectedConversationData.mode)}</small>
                    </div>
                  </div>

                  <div className="chat-body">
                    {selectedConversationData.messages.length === 0 ? (
                      <div className="empty-state compact">
                        <p>Aucun message pour l’instant.</p>
                      </div>
                    ) : (
                      selectedConversationData.messages.map((message) => (
                        <div key={message.id} className={message.sender === 'me' ? 'bubble me' : 'bubble them'}>
                          {message.text}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="composer">
                    <input
                      type="text"
                      placeholder="Écrire un message..."
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <button className="primary-button" onClick={handleSendMessage}>Envoyer</button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {view === 'profile' && (
          <section className="content-panel profile-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Profil</p>
                <h2>Modifier mon profil</h2>
              </div>
            </div>

            <form className="profile-form" onSubmit={handleProfileSave} noValidate>
              <div className="form-grid">
                <label>
                  <span>Prénom</span>
                  <input
                    name="name"
                    value={profileForm.name}
                    onChange={handleProfileFieldChange}
                    aria-invalid={Boolean(profileErrors.name)}
                    aria-describedby={profileErrors.name ? 'error-name' : undefined}
                    required
                  />
                  {profileErrors.name ? <small id="error-name" className="field-error">{profileErrors.name}</small> : null}
                </label>
                <label>
                  <span>Âge</span>
                  <input
                    name="age"
                    type="number"
                    min="18"
                    max="80"
                    value={profileForm.age}
                    onChange={handleProfileFieldChange}
                    aria-invalid={Boolean(profileErrors.age)}
                    aria-describedby={profileErrors.age ? 'error-age' : undefined}
                    required
                  />
                  {profileErrors.age ? <small id="error-age" className="field-error">{profileErrors.age}</small> : null}
                </label>
                <label>
                  <span>Ville</span>
                  <input
                    name="city"
                    value={profileForm.city}
                    onChange={handleProfileFieldChange}
                    aria-invalid={Boolean(profileErrors.city)}
                    aria-describedby={profileErrors.city ? 'error-city' : undefined}
                    required
                  />
                  {profileErrors.city ? <small id="error-city" className="field-error">{profileErrors.city}</small> : null}
                </label>
                <label>
                  <span>Catégorie principale</span>
                  <select name="mode" value={profileForm.mode} onChange={handleProfileFieldChange}>
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
                  value={profileForm.avatar}
                  onChange={handleProfileFieldChange}
                  placeholder="https://..."
                />
              </label>

              <label>
                <span>Bio</span>
                <textarea
                  name="bio"
                  rows="4"
                  value={profileForm.bio}
                  onChange={handleProfileFieldChange}
                  aria-invalid={Boolean(profileErrors.bio)}
                  aria-describedby={profileErrors.bio ? 'error-bio' : undefined}
                  required
                />
                {profileErrors.bio ? <small id="error-bio" className="field-error">{profileErrors.bio}</small> : null}
              </label>

              <label>
                <span>Centres d’intérêt (séparés par des virgules)</span>
                <input
                  name="interests"
                  value={profileForm.interests}
                  onChange={handleProfileFieldChange}
                  placeholder="voyage, musique, sport"
                />
              </label>

              <div className="form-actions">
                <button type="submit" className="primary-button">Sauvegarder</button>
              </div>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

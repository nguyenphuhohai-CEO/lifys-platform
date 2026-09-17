import { useEffect, useMemo, useState } from 'react';
import {
  FALLBACK_AVATAR,
  filterProfiles,
  formatInterests,
  normalizeInterests,
  sanitizeMessages,
  sanitizeProfile,
  shouldCreateMatch,
  validateProfile,
} from './lib/app-utils';
import { resetPrototypeStorage, safeReadJSON, writeJSON } from './lib/storage';

const MODES = [
  { id: 'amical', label: 'Amical', accent: '#9a7cff', icon: '💙' },
  { id: 'amoureux', label: 'Amoureux', accent: '#ff6bb5', icon: '💜' },
  { id: 'sans-lendemain', label: 'Sans lendemain', accent: '#ff8c42', icon: '🔥' },
  { id: 'mariage', label: 'Mariage', accent: '#f7c948', icon: '💍' },
  { id: 'professionnel', label: 'Professionnel', accent: '#52c7c0', icon: '💼' },
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
  { id: 'p9', name: 'Lea', age: 30, city: 'Nantes', bio: 'Consultante, curieuse, drôle et ouverte à des rencontres profondes.', interests: ['travail', 'sport', 'cinéma'], mode: 'professionnel', avatar: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80' },
  { id: 'p10', name: 'Hugo', age: 25, city: 'Paris', bio: 'J’aime les soirées spontanées, les bonnes discussions et la joie de vivre.', interests: ['danse', 'nuit', 'amis'], mode: 'sans-lendemain', avatar: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80' },
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

const STORAGE_KEYS = {
  profile: 'lifys-profile',
  likes: 'lifys-likes',
  matches: 'lifys-matches',
  messages: 'lifys-messages',
  passed: 'lifys-passed',
};

const defaultProfile = {
  name: '',
  age: 28,
  city: '',
  bio: '',
  interests: [],
  mode: 'amoureux',
  avatar: '',
};

const NAV_ITEMS = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'profile', label: 'Profil' },
];

function readInitialState() {
  const profileRead = safeReadJSON(STORAGE_KEYS.profile, defaultProfile, {
    validate: (value) => value && typeof value === 'object',
  });
  const likesRead = safeReadJSON(STORAGE_KEYS.likes, [], { validate: Array.isArray });
  const passedRead = safeReadJSON(STORAGE_KEYS.passed, [], { validate: Array.isArray });
  const matchesRead = safeReadJSON(STORAGE_KEYS.matches, [], { validate: Array.isArray });
  const messagesRead = safeReadJSON(STORAGE_KEYS.messages, DEFAULT_MESSAGES, { validate: Array.isArray });

  const recovered = [profileRead, likesRead, passedRead, matchesRead, messagesRead].some((item) => item.recovered);

  return {
    profile: sanitizeProfile(profileRead.value, defaultProfile),
    likes: likesRead.value.filter((value) => typeof value === 'string'),
    passed: passedRead.value.filter((value) => typeof value === 'string'),
    matches: matchesRead.value.filter((value) => value && typeof value.profileId === 'string'),
    messages: sanitizeMessages(messagesRead.value, DEFAULT_MESSAGES),
    recovered,
  };
}

function App() {
  const [initialState] = useState(() => readInitialState());
  const [view, setView] = useState('home');
  const [activeMode, setActiveMode] = useState('all');
  const [profile, setProfile] = useState(initialState.profile);
  const [profileDraft, setProfileDraft] = useState(initialState.profile);
  const [profileErrors, setProfileErrors] = useState({});
  const [likes, setLikes] = useState(initialState.likes);
  const [passed, setPassed] = useState(initialState.passed);
  const [matches, setMatches] = useState(initialState.matches);
  const [messages, setMessages] = useState(initialState.messages);
  const [draftMessage, setDraftMessage] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(initialState.messages[0]?.id || null);
  const [toasts, setToasts] = useState(() => (initialState.recovered ? [{ id: Date.now(), text: 'Certaines données locales étaient corrompues et ont été réinitialisées.', type: 'warning' }] : []));
  const [searchText, setSearchText] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setIsReady(true), 120);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    writeJSON(STORAGE_KEYS.profile, profile);
  }, [profile]);

  useEffect(() => {
    writeJSON(STORAGE_KEYS.likes, likes);
  }, [likes]);

  useEffect(() => {
    writeJSON(STORAGE_KEYS.passed, passed);
  }, [passed]);

  useEffect(() => {
    writeJSON(STORAGE_KEYS.matches, matches);
  }, [matches]);

  useEffect(() => {
    writeJSON(STORAGE_KEYS.messages, messages);
  }, [messages]);

  useEffect(() => {
    if (!messages.length) {
      setSelectedConversation(null);
      return;
    }

    const exists = messages.some((item) => item.id === selectedConversation);
    if (!selectedConversation || !exists) {
      setSelectedConversation(messages[0].id);
    }
  }, [messages, selectedConversation]);

  useEffect(() => {
    if (!toasts.length) return undefined;

    const timeout = setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 3200);

    return () => clearTimeout(timeout);
  }, [toasts]);

  const pushToast = (text, type = 'info') => {
    setToasts((current) => [...current, { id: Date.now() + Math.random(), text, type }]);
  };

  const filteredProfiles = useMemo(() => {
    return filterProfiles({
      profiles: DEMO_PROFILES,
      likes,
      passed,
      activeMode,
      profileMode: 'all',
      searchText,
      cityFilter,
    });
  }, [activeMode, cityFilter, likes, passed, searchText]);

  const selectedConversationData = useMemo(
    () => messages.find((item) => item.id === selectedConversation) || null,
    [messages, selectedConversation]
  );

  const availableCount = filteredProfiles.length;
  const totalInMode = DEMO_PROFILES.filter((item) => activeMode === 'all' || item.mode === activeMode).length;
  const modeLabel = MODES.find((item) => item.id === profile.mode)?.label || 'Amoureux';

  const handleProfileSave = async (event) => {
    event.preventDefault();
    const nextErrors = validateProfile(profileDraft);
    setProfileErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      pushToast('Le profil contient des champs invalides.', 'error');
      return;
    }

    setIsSavingProfile(true);

    const nextProfile = {
      ...profileDraft,
      name: profileDraft.name.trim(),
      city: profileDraft.city.trim(),
      bio: profileDraft.bio.trim(),
      interests: normalizeInterests(profileDraft.interests),
    };

    await Promise.resolve();
    setProfile(nextProfile);
    setProfileDraft(nextProfile);
    setView('discover');
    pushToast('Profil sauvegardé localement.', 'success');
    setIsSavingProfile(false);
  };

  const handleLike = (profileId) => {
    if (likes.includes(profileId)) return;

    const profileTarget = DEMO_PROFILES.find((item) => item.id === profileId);
    if (!profileTarget) return;

    setLikes((current) => [...current, profileId]);

    if (shouldCreateMatch(profileTarget, profile)) {
      setMatches((current) => {
        const existing = current.find((match) => match.profileId === profileId);
        if (existing) return current;

        const nextMatch = {
          id: `match-${profileId}`,
          profileId,
          name: profileTarget.name,
          city: profileTarget.city,
          mode: profileTarget.mode,
          avatar: profileTarget.avatar,
          lastMessage: 'Vous avez un nouveau match local.',
        };

        pushToast(`Nouveau match avec ${profileTarget.name}.`, 'success');
        return [...current, nextMatch];
      });
    }
  };

  const handlePass = (profileId) => {
    if (passed.includes(profileId)) return;
    setPassed((current) => [...current, profileId]);
  };

  const handleSendMessage = () => {
    const text = draftMessage.trim();
    if (!text || !selectedConversation) return;

    setMessages((current) =>
      current.map((item) => {
        if (item.id !== selectedConversation) return item;

        const nextMessage = {
          id: `msg-${Date.now()}`,
          sender: 'me',
          text,
        };

        return {
          ...item,
          messages: [...item.messages, nextMessage],
        };
      })
    );

    setDraftMessage('');
  };

  const goToConversation = (match) => {
    const existingConversation = messages.find((item) => item.profileId === match.profileId);

    if (existingConversation) {
      setSelectedConversation(existingConversation.id);
      setView('messages');
      return;
    }

    const nextConversation = {
      id: `conv-${match.profileId}`,
      profileId: match.profileId,
      name: match.name,
      mode: match.mode,
      avatar: match.avatar,
      messages: [
        {
          id: `intro-${match.profileId}`,
          sender: 'them',
          text: 'Ravi de matcher avec toi ! On échange ?',
        },
      ],
    };

    setMessages((current) => [...current, nextConversation]);
    setSelectedConversation(nextConversation.id);
    setView('messages');
  };

  const handleResetPrototype = () => {
    resetPrototypeStorage(Object.values(STORAGE_KEYS));
    setProfile(defaultProfile);
    setProfileDraft(defaultProfile);
    setProfileErrors({});
    setLikes([]);
    setPassed([]);
    setMatches([]);
    setMessages(DEFAULT_MESSAGES);
    setSelectedConversation(DEFAULT_MESSAGES[0]?.id || null);
    setSearchText('');
    setCityFilter('');
    setActiveMode('all');
    setView('home');
    pushToast('Prototype local réinitialisé.', 'success');
  };

  const updateProfileDraft = (field, value) => {
    setProfileDraft((current) => ({ ...current, [field]: value }));
    setProfileErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand-block" onClick={() => setView('home')}>
          <span className="brand-icon">❤</span>
          <span>
            <strong>Lifys</strong>
            <small>Rencontres qui comptent</small>
          </span>
        </button>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={isMenuOpen}
          aria-controls="main-nav"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          Menu
        </button>

        <nav id="main-nav" className={isMenuOpen ? 'nav nav-open' : 'nav'} aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => (
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
        {!isReady ? (
          <section className="content-panel empty-state" role="status" aria-live="polite">
            <h3>Chargement de votre expérience locale…</h3>
          </section>
        ) : null}

        {view === 'home' && isReady && (
          <section className="hero-panel">
            <div className="hero-copy">
              <span className="eyebrow">MVP local · prototype</span>
              <h1>Une expérience premium, chaleureuse et sobre pour chaque type de rencontre.</h1>
              <p>
                Toutes les données restent locales dans ce navigateur (simulation). Aucune authentification réelle, aucun backend, aucun paiement.
              </p>
              <div className="cta-row">
                <button className="primary-button" onClick={() => setView('discover')}>Découvrir</button>
                <button className="secondary-button" onClick={() => setView('profile')}>Créer mon profil</button>
                <button className="secondary-button" onClick={handleResetPrototype}>Réinitialiser le prototype</button>
              </div>
            </div>

            <div className="hero-visual">
              <div className="mini-card large">
                <span className="mini-label">Mode actif</span>
                <h3>{modeLabel}</h3>
                <p>{profile.city || 'Ville non renseignée'} · {profile.age || '—'} ans</p>
              </div>
              <div className="mini-card small">
                <span>Matchs</span>
                <strong>{matches.length}</strong>
              </div>
            </div>
          </section>
        )}

        {view === 'home' && isReady && (
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
                <span className="mode-icon" style={{ color: mode.accent }}>{mode.icon}</span>
                <strong>{mode.label}</strong>
                <small>Rencontres {mode.label.toLowerCase()}</small>
              </button>
            ))}
          </section>
        )}

        {view === 'discover' && isReady && (
          <section className="content-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Découverte</p>
                <h2>Profils recommandés</h2>
                <p className="helper-text">{availableCount} profil(s) disponible(s) sur {totalInMode} dans ce filtre.</p>
              </div>
              <div className="mode-pills" aria-label="Filtre de mode">
                <button className={activeMode === 'all' ? 'pill active' : 'pill'} onClick={() => setActiveMode('all')}>Tous</button>
                {MODES.map((mode) => (
                  <button key={mode.id} className={activeMode === mode.id ? 'pill active' : 'pill'} onClick={() => setActiveMode(mode.id)}>{mode.label}</button>
                ))}
              </div>
            </div>

            <div className="filters-row">
              <input
                type="text"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Rechercher par nom, bio ou intérêt"
                aria-label="Recherche texte"
              />
              <input
                type="text"
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
                placeholder="Filtrer par ville"
                aria-label="Recherche par ville"
              />
            </div>

            {filteredProfiles.length === 0 ? (
              <div className="empty-state">
                <h3>Plus de profils pour le moment</h3>
                <p>Essayez une autre catégorie, une autre ville ou réinitialisez le prototype local.</p>
              </div>
            ) : (
              <div className="discover-grid">
                {filteredProfiles.slice(0, 6).map((person) => (
                  <article key={person.id} className="profile-card">
                    <img
                      src={person.avatar || FALLBACK_AVATAR}
                      alt={person.name}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = FALLBACK_AVATAR;
                      }}
                    />
                    <div className="profile-card-body">
                      <div className="identity-row">
                        <h3>{person.name}, {person.age}</h3>
                        <span className="tag">{MODES.find((mode) => mode.id === person.mode)?.label}</span>
                      </div>
                      <p className="city-line">📍 {person.city}</p>
                      <p>{person.bio}</p>
                      <div className="interest-row">
                        {formatInterests(person.interests).map((item) => (
                          <span key={item}>{item}</span>
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
            )}
          </section>
        )}

        {view === 'matches' && isReady && (
          <section className="content-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Matchs</p>
                <h2>Vos correspondances</h2>
              </div>
            </div>

            {matches.length === 0 ? (
              <div className="empty-state">
                <h3>Aucun match pour l’instant</h3>
                <p>Commencez à liker des profils compatibles pour créer une première connexion.</p>
              </div>
            ) : (
              <div className="matches-list">
                {matches.map((match) => (
                  <article key={match.id} className="match-item">
                    <img
                      src={match.avatar || FALLBACK_AVATAR}
                      alt={match.name}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = FALLBACK_AVATAR;
                      }}
                    />
                    <div>
                      <h3>{match.name}</h3>
                      <p>{match.city} · {MODES.find((mode) => mode.id === match.mode)?.label}</p>
                      <small>{match.lastMessage}</small>
                    </div>
                    <button className="secondary-button" onClick={() => goToConversation(match)}>Ouvrir la messagerie</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'messages' && isReady && (
          <section className="messages-layout content-panel">
            <aside className="conversation-list" aria-label="Liste des conversations">
              {messages.length === 0 ? (
                <div className="empty-state compact">
                  <h3>Aucune conversation</h3>
                  <p>Créez un match pour démarrer une discussion.</p>
                </div>
              ) : null}

              {messages.map((conversation) => (
                <button
                  key={conversation.id}
                  className={selectedConversation === conversation.id ? 'conversation-item active' : 'conversation-item'}
                  onClick={() => setSelectedConversation(conversation.id)}
                >
                  <img
                    src={conversation.avatar || FALLBACK_AVATAR}
                    alt={conversation.name}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = FALLBACK_AVATAR;
                    }}
                  />
                  <div>
                    <strong>{conversation.name}</strong>
                    <small>{conversation.messages[conversation.messages.length - 1]?.text || 'Aucun message'}</small>
                  </div>
                </button>
              ))}
            </aside>

            <div className="chat-panel">
              {selectedConversationData ? (
                <>
                  <div className="chat-header">
                    <img
                      src={selectedConversationData.avatar || FALLBACK_AVATAR}
                      alt={selectedConversationData.name}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = FALLBACK_AVATAR;
                      }}
                    />
                    <div>
                      <strong>{selectedConversationData.name}</strong>
                      <small>{MODES.find((mode) => mode.id === selectedConversationData.mode)?.label}</small>
                    </div>
                  </div>

                  <div className="chat-body">
                    {selectedConversationData.messages.length === 0 ? (
                      <div className="empty-state compact">
                        <p>Aucun message dans cette conversation.</p>
                      </div>
                    ) : null}

                    {selectedConversationData.messages.map((message) => (
                      <div key={message.id} className={message.sender === 'me' ? 'bubble me' : 'bubble them'}>
                        {message.text}
                      </div>
                    ))}
                  </div>

                  <div className="composer">
                    <input
                      type="text"
                      placeholder="Écrire un message..."
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <button className="primary-button" onClick={handleSendMessage}>Envoyer</button>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <h3>Sélectionnez une conversation</h3>
                  <p>Choisissez un contact pour voir vos messages.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {view === 'profile' && isReady && (
          <section className="content-panel profile-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Profil</p>
                <h2>Complétez votre profil</h2>
                <p className="helper-text">Les informations sont stockées uniquement dans votre navigateur.</p>
              </div>
            </div>

            <form className="profile-form" onSubmit={handleProfileSave} noValidate>
              <div className="avatar-preview">
                <img
                  src={profileDraft.avatar || FALLBACK_AVATAR}
                  alt="Aperçu avatar"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = FALLBACK_AVATAR;
                  }}
                />
              </div>

              <div className="form-grid">
                <label>
                  <span>Prénom</span>
                  <input
                    name="name"
                    value={profileDraft.name}
                    onChange={(event) => updateProfileDraft('name', event.target.value)}
                    placeholder="Sofia"
                    aria-invalid={Boolean(profileErrors.name)}
                    aria-describedby={profileErrors.name ? 'profile-name-error' : undefined}
                  />
                  {profileErrors.name ? <small id="profile-name-error" className="field-error">{profileErrors.name}</small> : null}
                </label>
                <label>
                  <span>Âge</span>
                  <input
                    name="age"
                    type="number"
                    min="18"
                    max="80"
                    value={profileDraft.age}
                    onChange={(event) => updateProfileDraft('age', event.target.value)}
                    aria-invalid={Boolean(profileErrors.age)}
                    aria-describedby={profileErrors.age ? 'profile-age-error' : undefined}
                  />
                  {profileErrors.age ? <small id="profile-age-error" className="field-error">{profileErrors.age}</small> : null}
                </label>
                <label>
                  <span>Ville</span>
                  <input
                    name="city"
                    value={profileDraft.city}
                    onChange={(event) => updateProfileDraft('city', event.target.value)}
                    placeholder="Paris"
                    aria-invalid={Boolean(profileErrors.city)}
                    aria-describedby={profileErrors.city ? 'profile-city-error' : undefined}
                  />
                  {profileErrors.city ? <small id="profile-city-error" className="field-error">{profileErrors.city}</small> : null}
                </label>
                <label>
                  <span>Mode de rencontre</span>
                  <select
                    name="mode"
                    value={profileDraft.mode}
                    onChange={(event) => updateProfileDraft('mode', event.target.value)}
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
                  onChange={(event) => updateProfileDraft('avatar', event.target.value)}
                  placeholder="https://..."
                />
              </label>

              <label>
                <span>Bio</span>
                <textarea
                  name="bio"
                  rows="4"
                  value={profileDraft.bio}
                  onChange={(event) => updateProfileDraft('bio', event.target.value)}
                  placeholder="Décrivez votre personnalité et ce que vous recherchez."
                  aria-invalid={Boolean(profileErrors.bio)}
                  aria-describedby={profileErrors.bio ? 'profile-bio-error' : undefined}
                />
                {profileErrors.bio ? <small id="profile-bio-error" className="field-error">{profileErrors.bio}</small> : null}
              </label>

              <label>
                <span>Centres d’intérêt</span>
                <input
                  name="interests"
                  value={Array.isArray(profileDraft.interests) ? profileDraft.interests.join(', ') : profileDraft.interests}
                  onChange={(event) => updateProfileDraft('interests', event.target.value)}
                  placeholder="voyage, musique, sport"
                />
              </label>

              <div className="form-actions">
                <button type="submit" className="primary-button" disabled={isSavingProfile}>
                  {isSavingProfile ? 'Sauvegarde...' : 'Sauvegarder'}
                </button>
              </div>
            </form>
          </section>
        )}
      </main>

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`} role="status">
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;

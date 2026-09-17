import { useEffect, useMemo, useState } from 'react';

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

const defaultProfile = {
  name: '',
  age: '',
  city: '',
  bio: '',
  interests: '',
  mode: 'amoureux',
  avatar: '',
};

function App() {
  const [view, setView] = useState('home');
  const [activeMode, setActiveMode] = useState('all');
  const [profile, setProfile] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.profile);
    return raw ? JSON.parse(raw) : defaultProfile;
  });
  const [likes, setLikes] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.likes);
    return raw ? JSON.parse(raw) : [];
  });
  const [passed, setPassed] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.passed);
    return raw ? JSON.parse(raw) : [];
  });
  const [matches, setMatches] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.matches);
    return raw ? JSON.parse(raw) : [];
  });
  const [messages, setMessages] = useState(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.messages);
    return raw ? JSON.parse(raw) : DEFAULT_MESSAGES;
  });
  const [draftMessage, setDraftMessage] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(DEFAULT_MESSAGES[0]?.id || null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.likes, JSON.stringify(likes));
  }, [likes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.passed, JSON.stringify(passed));
  }, [passed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.matches, JSON.stringify(matches));
  }, [matches]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [messages]);

  const activeProfileMode = profile?.mode || 'amoureux';

  const filteredProfiles = useMemo(() => {
    return DEMO_PROFILES.filter((profileItem) => {
      const isNotSaved = !likes.includes(profileItem.id) && !passed.includes(profileItem.id);
      const modeMatch = activeMode === 'all' ? true : profileItem.mode === activeMode;
      const sameModeBanner = profileItem.mode === activeProfileMode || activeProfileMode === 'amoureux';
      return isNotSaved && modeMatch && sameModeBanner;
    });
  }, [activeMode, likes, passed, activeProfileMode]);

  const handleProfileSave = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextProfile = {
      name: formData.get('name')?.toString().trim() || '',
      age: Number(formData.get('age') || 0),
      city: formData.get('city')?.toString().trim() || '',
      bio: formData.get('bio')?.toString().trim() || '',
      interests: formData.get('interests')?.toString().trim() || '',
      mode: formData.get('mode')?.toString() || 'amoureux',
      avatar: formData.get('avatar')?.toString().trim() || '',
    };

    if (!nextProfile.name || !nextProfile.city || !nextProfile.bio) {
      alert('Merci de remplir votre nom, ville et bio pour continuer.');
      return;
    }

    setProfile(nextProfile);
    setView('discover');
  };

  const handleLike = (profileId) => {
    if (likes.includes(profileId)) return;
    const nextLikes = [...likes, profileId];
    setLikes(nextLikes);

    const profileTarget = DEMO_PROFILES.find((item) => item.id === profileId);
    if (!profileTarget) return;

    const modeCompatible = profileTarget.mode === (profile?.mode || 'amoureux');
    const cityCompatible = profileTarget.city === profile?.city;
    const interestOverlap = profile?.interests
      ?.split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
      .some((value) => profileTarget.interests.some((interest) => interest.toLowerCase() === value));

    if (modeCompatible || cityCompatible || interestOverlap) {
      const existing = matches.find((match) => match.profileId === profileId);
      if (!existing) {
        setMatches((current) => [
          ...current,
          {
            id: `match-${profileId}`,
            profileId: profileId,
            name: profileTarget.name,
            city: profileTarget.city,
            mode: profileTarget.mode,
            avatar: profileTarget.avatar,
            lastMessage: 'Vous avez un match !',
          },
        ]);
      }
    }
  };

  const handlePass = (profileId) => {
    if (passed.includes(profileId)) return;
    setPassed((current) => [...current, profileId]);
  };

  const handleSendMessage = () => {
    if (!draftMessage.trim() || !selectedConversation) return;

    const conversation = messages.find((item) => item.id === selectedConversation);
    if (!conversation) return;

    const nextMessage = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: draftMessage.trim(),
    };

    setMessages((current) => current.map((item) =>
      item.id === selectedConversation
        ? { ...item, messages: [...item.messages, nextMessage], lastMessage: draftMessage.trim() }
        : item
    ));
    setDraftMessage('');
  };

  const selectedConversationData = messages.find((item) => item.id === selectedConversation) || messages[0];

  const matchCount = matches.length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block" onClick={() => setView('home')} role="button" tabIndex={0}>
          <span className="brand-icon">❤</span>
          <div>
            <strong>Lifys</strong>
            <small>Rencontres qui comptent</small>
          </div>
        </div>

        <nav className="nav" aria-label="Navigation principale">
          {['home', 'discover', 'matches', 'messages', 'profile'].map((item) => (
            <button
              key={item}
              className={view === item ? 'nav-button active' : 'nav-button'}
              onClick={() => setView(item)}
            >
              {item === 'home' && 'Accueil'}
              {item === 'discover' && 'Découvrir'}
              {item === 'matches' && 'Matchs'}
              {item === 'messages' && 'Messages'}
              {item === 'profile' && 'Profil'}
            </button>
          ))}
        </nav>
      </header>

      <main className="page-shell">
        {view === 'home' && (
          <section className="hero-panel">
            <div className="hero-copy">
              <span className="eyebrow">MVP local · prototype</span>
              <h1>Rencontrez les bonnes personnes, selon le type de relation que vous cherchez.</h1>
              <p>
                Lifys rassemble les rencontres amicales, romantiques, sans lendemain, de mariage et professionnelles dans une seule expérience pensée pour le web mobile.
              </p>
              <div className="cta-row">
                <button className="primary-button" onClick={() => setView('discover')}>Découvrir</button>
                <button className="secondary-button" onClick={() => setView('profile')}>Créer mon profil</button>
              </div>
            </div>

            <div className="hero-visual">
              <div className="mini-card large">
                <span className="mini-label">Mode actif</span>
                <h3>{profile?.mode ? MODES.find((mode) => mode.id === profile.mode)?.label : 'Amoureux'}</h3>
                <p>{profile?.city || 'Paris'}, {profile?.age || '25'} ans</p>
              </div>
              <div className="mini-card small">
                <span>Matchs</span>
                <strong>{matchCount}</strong>
              </div>
            </div>
          </section>
        )}

        {view === 'home' && (
          <section className="mode-grid">
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
        )}

        {view === 'discover' && (
          <section className="content-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Découverte</p>
                <h2>Profils recommandés</h2>
              </div>
              <div className="mode-pills" aria-label="Filtre de mode">
                <button className={activeMode === 'all' ? 'pill active' : 'pill'} onClick={() => setActiveMode('all')}>Tous</button>
                {MODES.map((mode) => (
                  <button key={mode.id} className={activeMode === mode.id ? 'pill active' : 'pill'} onClick={() => setActiveMode(mode.id)}>{mode.label}</button>
                ))}
              </div>
            </div>

            {filteredProfiles.length === 0 ? (
              <div className="empty-state">
                <h3>Plus de profils pour le moment</h3>
                <p>Vous avez vu tous les profils disponibles pour ce mode. Essayez une autre catégorie ou mettez votre profil à jour.</p>
              </div>
            ) : (
              <div className="discover-grid">
                {filteredProfiles.slice(0, 4).map((person) => (
                  <article key={person.id} className="profile-card">
                    <img src={person.avatar} alt={person.name} />
                    <div className="profile-card-body">
                      <div className="identity-row">
                        <h3>{person.name}, {person.age}</h3>
                        <span className="tag">{MODES.find((mode) => mode.id === person.mode)?.label}</span>
                      </div>
                      <p className="city-line">📍 {person.city}</p>
                      <p>{person.bio}</p>
                      <div className="interest-row">
                        {person.interests.map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                      </div>
                    </div>
                    <div className="card-actions">
                      <button className="pass-button" onClick={() => handlePass(person.id)}>Pass</button>
                      <button className="like-button" onClick={() => handleLike(person.id)}>Like</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'matches' && (
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
                    <img src={match.avatar} alt={match.name} />
                    <div>
                      <h3>{match.name}</h3>
                      <p>{match.city} · {MODES.find((mode) => mode.id === match.mode)?.label}</p>
                      <small>{match.lastMessage}</small>
                    </div>
                    <button className="secondary-button" onClick={() => {
                      setSelectedConversation(messages.find((item) => item.profileId === match.profileId)?.id || null);
                      setView('messages');
                    }}>Envoyer un message</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'messages' && (
          <section className="messages-layout content-panel">
            <aside className="conversation-list">
              {messages.map((conversation) => (
                <button
                  key={conversation.id}
                  className={selectedConversation === conversation.id ? 'conversation-item active' : 'conversation-item'}
                  onClick={() => setSelectedConversation(conversation.id)}
                >
                  <img src={conversation.avatar} alt={conversation.name} />
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
                    <img src={selectedConversationData.avatar} alt={selectedConversationData.name} />
                    <div>
                      <strong>{selectedConversationData.name}</strong>
                      <small>{MODES.find((mode) => mode.id === selectedConversationData.mode)?.label}</small>
                    </div>
                  </div>

                  <div className="chat-body">
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
                          handleSendMessage();
                        }
                      }}
                    />
                    <button className="primary-button" onClick={handleSendMessage}>Envoyer</button>
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <h3>Aucune conversation</h3>
                </div>
              )}
            </div>
          </section>
        )}

        {view === 'profile' && (
          <section className="content-panel profile-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Profil</p>
                <h2>Complétez votre profil</h2>
              </div>
            </div>

            <form className="profile-form" onSubmit={handleProfileSave}>
              <div className="form-grid">
                <label>
                  <span>Prénom</span>
                  <input name="name" defaultValue={profile?.name || ''} placeholder="Sofia" />
                </label>
                <label>
                  <span>Âge</span>
                  <input name="age" type="number" min="18" max="80" defaultValue={profile?.age || 28} />
                </label>
                <label>
                  <span>Ville</span>
                  <input name="city" defaultValue={profile?.city || ''} placeholder="Paris" />
                </label>
                <label>
                  <span>Mode de rencontre</span>
                  <select name="mode" defaultValue={profile?.mode || 'amoureux'}>
                    {MODES.map((mode) => (
                      <option key={mode.id} value={mode.id}>{mode.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                <span>Avatar URL</span>
                <input name="avatar" defaultValue={profile?.avatar || ''} placeholder="https://..." />
              </label>

              <label>
                <span>Bio</span>
                <textarea name="bio" rows="4" defaultValue={profile?.bio || ''} placeholder="Décrivez votre personnalité et ce que vous recherchez." />
              </label>

              <label>
                <span>Centres d’intérêt</span>
                <input name="interests" defaultValue={profile?.interests || ''} placeholder="voyage, musique, sport" />
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

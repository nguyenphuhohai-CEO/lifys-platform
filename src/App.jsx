import { useEffect, useMemo, useState } from 'react';
import Header from './components/Header';
import HomeView from './components/HomeView';
import DiscoverView from './components/DiscoverView';
import MatchesView from './components/MatchesView';
import MessagesView from './components/MessagesView';
import ProfileView from './components/ProfileView';
import Toast from './components/Toast';
import {
  DEFAULT_MESSAGES,
  DEFAULT_PROFILE,
  DEMO_PROFILES,
  STORAGE_KEYS,
} from './constants';
import { filterProfiles, formatInterests, isPotentialMatch } from './lib/matching';
import { resetPrototypeStorage, safeReadJSON, writeJSON } from './lib/storage';

const STORAGE_SCHEMA = {
  [STORAGE_KEYS.profile]: (value) => value && typeof value === 'object' && !Array.isArray(value),
  [STORAGE_KEYS.likes]: Array.isArray,
  [STORAGE_KEYS.passed]: Array.isArray,
  [STORAGE_KEYS.matches]: Array.isArray,
  [STORAGE_KEYS.messages]: Array.isArray,
  [STORAGE_KEYS.activeMode]: (value) => typeof value === 'string',
};

function loadInitialState() {
  const profile = safeReadJSON(STORAGE_KEYS.profile, DEFAULT_PROFILE, STORAGE_SCHEMA[STORAGE_KEYS.profile]);
  const likes = safeReadJSON(STORAGE_KEYS.likes, [], STORAGE_SCHEMA[STORAGE_KEYS.likes]);
  const passed = safeReadJSON(STORAGE_KEYS.passed, [], STORAGE_SCHEMA[STORAGE_KEYS.passed]);
  const matches = safeReadJSON(STORAGE_KEYS.matches, [], STORAGE_SCHEMA[STORAGE_KEYS.matches]);
  const messages = safeReadJSON(
    STORAGE_KEYS.messages,
    DEFAULT_MESSAGES,
    STORAGE_SCHEMA[STORAGE_KEYS.messages]
  );
  const activeMode = safeReadJSON(STORAGE_KEYS.activeMode, 'all', STORAGE_SCHEMA[STORAGE_KEYS.activeMode]);

  return {
    profile: { ...DEFAULT_PROFILE, ...profile.value },
    likes: likes.value,
    passed: passed.value,
    matches: matches.value,
    messages: messages.value,
    activeMode: activeMode.value,
    recovered:
      profile.recovered ||
      likes.recovered ||
      passed.recovered ||
      matches.recovered ||
      messages.recovered ||
      activeMode.recovered,
  };
}

function createToast(type, message) {
  return { id: `${Date.now()}-${Math.random()}`, type, message };
}

function buildConversationFromMatch(match) {
  return {
    id: `conv-${match.profileId}`,
    profileId: match.profileId,
    name: match.name,
    mode: match.mode,
    avatar: match.avatar,
    messages: [{ id: `welcome-${Date.now()}`, sender: 'them', text: 'Ravi(e) de discuter avec toi !' }],
  };
}

function App() {
  const initial = useMemo(() => loadInitialState(), []);

  const [view, setView] = useState('home');
  const [activeMode, setActiveMode] = useState(initial.activeMode);
  const [profile, setProfile] = useState(initial.profile);
  const [likes, setLikes] = useState(initial.likes);
  const [passed, setPassed] = useState(initial.passed);
  const [matches, setMatches] = useState(initial.matches);
  const [messages, setMessages] = useState(initial.messages);
  const [selectedConversation, setSelectedConversation] = useState(initial.messages[0]?.id || null);
  const [draftMessage, setDraftMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [profileErrors, setProfileErrors] = useState({});
  const [toasts, setToasts] = useState(
    initial.recovered
      ? [createToast('warning', 'Certaines données locales étaient corrompues et ont été réinitialisées.')]
      : []
  );

  const pushToast = (type, message) => {
    const toast = createToast(type, message);
    setToasts((current) => [...current, toast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 3500);
  };

  const dismissToast = (id) => setToasts((current) => current.filter((item) => item.id !== id));

  useEffect(() => writeJSON(STORAGE_KEYS.profile, profile), [profile]);
  useEffect(() => writeJSON(STORAGE_KEYS.likes, likes), [likes]);
  useEffect(() => writeJSON(STORAGE_KEYS.passed, passed), [passed]);
  useEffect(() => writeJSON(STORAGE_KEYS.matches, matches), [matches]);
  useEffect(() => writeJSON(STORAGE_KEYS.messages, messages), [messages]);
  useEffect(() => writeJSON(STORAGE_KEYS.activeMode, activeMode), [activeMode]);

  useEffect(() => {
    if (messages.length === 0) {
      setSelectedConversation(null);
      return;
    }

    if (!messages.some((item) => item.id === selectedConversation)) {
      setSelectedConversation(messages[0].id);
    }
  }, [messages, selectedConversation]);

  const filteredProfiles = useMemo(
    () =>
      filterProfiles({
        profiles: DEMO_PROFILES,
        activeMode,
        likes,
        passed,
        profileMode: profile.mode || 'amoureux',
        searchTerm,
        cityFilter,
      }),
    [activeMode, likes, passed, profile.mode, searchTerm, cityFilter]
  );

  const handleProfileSave = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const nextProfile = {
      name: formData.get('name')?.toString().trim() || '',
      age: Number(formData.get('age') || 0),
      city: formData.get('city')?.toString().trim() || '',
      bio: formData.get('bio')?.toString().trim() || '',
      interests: formatInterests(formData.get('interests')?.toString().trim() || ''),
      mode: formData.get('mode')?.toString() || 'amoureux',
      avatar: formData.get('avatar')?.toString().trim() || '',
    };

    const errors = {};
    if (!nextProfile.name) errors.name = 'Le prénom est requis.';
    if (!nextProfile.city) errors.city = 'La ville est requise.';
    if (!nextProfile.bio || nextProfile.bio.length < 20) {
      errors.bio = 'La bio doit contenir au moins 20 caractères.';
    }
    if (nextProfile.age < 18 || nextProfile.age > 80) {
      errors.age = 'Âge invalide.';
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      pushToast('error', 'Le profil contient des informations manquantes ou invalides.');
      return;
    }

    setProfileErrors({});
    setProfile(nextProfile);
    setView('discover');
    pushToast('success', 'Profil sauvegardé avec succès.');
  };

  const ensureConversation = (match) => {
    const existing = messages.find((item) => item.profileId === match.profileId);
    if (existing) {
      setSelectedConversation(existing.id);
      return;
    }

    const nextConversation = buildConversationFromMatch(match);
    setMessages((current) => [nextConversation, ...current]);
    setSelectedConversation(nextConversation.id);
  };

  const handleLike = (profileId) => {
    if (likes.includes(profileId)) return;

    setLikes((current) => [...current, profileId]);
    const profileTarget = DEMO_PROFILES.find((item) => item.id === profileId);
    if (!profileTarget) return;

    if (isPotentialMatch(profile, profileTarget)) {
      const existing = matches.find((match) => match.profileId === profileId);
      if (!existing) {
        const newMatch = {
          id: `match-${profileId}`,
          profileId,
          name: profileTarget.name,
          city: profileTarget.city,
          mode: profileTarget.mode,
          avatar: profileTarget.avatar,
          status: 'Nouveau match',
          matchedAt: new Date().toISOString(),
        };
        setMatches((current) => [newMatch, ...current]);
        pushToast('success', `Nouveau match avec ${profileTarget.name} ✨`);
      }
    }
  };

  const handlePass = (profileId) => {
    if (passed.includes(profileId)) return;
    setPassed((current) => [...current, profileId]);
  };

  const handleSendMessage = () => {
    if (!draftMessage.trim() || !selectedConversation) return;

    const nextMessage = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: draftMessage.trim(),
    };

    setMessages((current) =>
      current.map((item) =>
        item.id === selectedConversation
          ? { ...item, messages: [...item.messages, nextMessage] }
          : item
      )
    );
    setDraftMessage('');
  };

  const handleOpenConversation = (match) => {
    ensureConversation(match);
    setView('messages');
  };

  const handleResetPrototype = () => {
    resetPrototypeStorage(Object.values(STORAGE_KEYS));
    setProfile(DEFAULT_PROFILE);
    setLikes([]);
    setPassed([]);
    setMatches([]);
    setMessages(DEFAULT_MESSAGES);
    setActiveMode('all');
    setSelectedConversation(DEFAULT_MESSAGES[0]?.id || null);
    setSearchTerm('');
    setCityFilter('');
    setProfileErrors({});
    setView('home');
    pushToast('success', 'Prototype réinitialisé. Toutes les données locales ont été effacées.');
  };

  const selectedConversationData =
    messages.find((item) => item.id === selectedConversation) || messages[0] || null;

  return (
    <div className="app-shell">
      <Header view={view} setView={setView} onResetPrototype={handleResetPrototype} />

      <main className="page-shell">
        {view === 'home' && (
          <HomeView
            profile={profile}
            matchCount={matches.length}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            setView={setView}
          />
        )}

        {view === 'discover' && (
          <DiscoverView
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            cityFilter={cityFilter}
            setCityFilter={setCityFilter}
            filteredProfiles={filteredProfiles}
            remainingCount={filteredProfiles.length}
            onLike={handleLike}
            onPass={handlePass}
          />
        )}

        {view === 'matches' && <MatchesView matches={matches} onOpenConversation={handleOpenConversation} />}

        {view === 'messages' && (
          <MessagesView
            messages={messages}
            selectedConversation={selectedConversation}
            setSelectedConversation={setSelectedConversation}
            selectedConversationData={selectedConversationData}
            draftMessage={draftMessage}
            setDraftMessage={setDraftMessage}
            onSendMessage={handleSendMessage}
          />
        )}

        {view === 'profile' && (
          <ProfileView profile={profile} errors={profileErrors} onSubmit={handleProfileSave} />
        )}
      </main>

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;

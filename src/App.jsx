import { useEffect, useMemo, useRef, useState } from 'react';
import Header from './components/Header';
import HomeView from './components/HomeView';
import DiscoverView from './components/DiscoverView';
import MatchesView from './components/MatchesView';
import MessagesView from './components/MessagesView';
import ProfileView from './components/ProfileView';
import Toast from './components/Toast';
import { DEFAULT_MESSAGES, DEMO_PROFILES, MODES, STORAGE_KEYS, defaultProfile } from './data/demoData';
import {
  createConversation,
  createMatch,
  filterProfiles,
  isCompatibleMatch,
  isStringArray,
  isValidMatchList,
  isValidMessageList,
  isValidProfileShape,
  sanitizeProfile,
  validateProfile,
} from './lib/appUtils';
import { resetPrototypeStorage, safeReadJSON, writeJSON } from './lib/storage';

function App() {
  const initialProfile = useMemo(() => safeReadJSON(STORAGE_KEYS.profile, defaultProfile, isValidProfileShape), []);
  const initialMessages = useMemo(() => safeReadJSON(STORAGE_KEYS.messages, DEFAULT_MESSAGES, isValidMessageList), []);
  const [view, setView] = useState('home');
  const [activeMode, setActiveMode] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const [profileDraft, setProfileDraft] = useState(initialProfile);
  const [profileErrors, setProfileErrors] = useState({});
  const [likes, setLikes] = useState(() => safeReadJSON(STORAGE_KEYS.likes, [], isStringArray));
  const [passed, setPassed] = useState(() => safeReadJSON(STORAGE_KEYS.passed, [], isStringArray));
  const [matches, setMatches] = useState(() => safeReadJSON(STORAGE_KEYS.matches, [], isValidMatchList));
  const [messages, setMessages] = useState(initialMessages);
  const [draftMessage, setDraftMessage] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(initialMessages[0]?.id || null);
  const [toasts, setToasts] = useState([]);
  const toastTimeoutsRef = useRef(new Set());

  useEffect(
    () => () => {
      toastTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      toastTimeoutsRef.current.clear();
    },
    [],
  );

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
    if (!messages.some((item) => item.id === selectedConversation)) {
      setSelectedConversation(messages[0]?.id || null);
    }
  }, [messages, selectedConversation]);

  useEffect(() => {
    if (Object.keys(profileErrors).length === 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => setProfileErrors({}), 6000);
    return () => window.clearTimeout(timer);
  }, [profileErrors]);

  const addToast = (title, description, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current, { id, title, description, type }]);

    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      toastTimeoutsRef.current.delete(timeoutId);
    }, 4200);

    toastTimeoutsRef.current.add(timeoutId);
  };

  const filteredProfiles = useMemo(
    () =>
      filterProfiles(DEMO_PROFILES, {
        activeMode,
        likes,
        passed,
        profileMode: profile.name ? profile.mode : 'all',
        searchTerm,
        cityFilter,
      }),
    [activeMode, cityFilter, likes, passed, profile.mode, searchTerm],
  );

  const selectedConversationData = messages.find((item) => item.id === selectedConversation) || null;

  const handleViewChange = (nextView) => {
    setView(nextView);
    setIsMobileNavOpen(false);
  };

  const handleProfileDraftChange = (field, value) => {
    setProfileDraft((current) => ({ ...current, [field]: value }));
  };

  const handleProfileSave = (event) => {
    event.preventDefault();
    const errors = validateProfile(profileDraft);

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      addToast('Profil incomplet', 'Corrigez les champs signalés pour continuer.', 'error');
      return;
    }

    const nextProfile = sanitizeProfile(profileDraft);
    setProfile(nextProfile);
    setProfileDraft(nextProfile);
    setProfileErrors({});
    setView('discover');
    addToast('Profil sauvegardé', 'Vos préférences locales ont été mises à jour.', 'success');
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

    if (isCompatibleMatch(profile, profileTarget)) {
      setMatches((current) => {
        if (current.some((match) => match.profileId === profileId)) {
          return current;
        }

        return [...current, createMatch(profileTarget)];
      });

      setMessages((current) => {
        if (current.some((conversation) => conversation.profileId === profileId)) {
          return current;
        }

        const nextConversation = createConversation(profileTarget);
        setSelectedConversation(nextConversation.id);
        return [nextConversation, ...current];
      });

      addToast('Nouveau match', `${profileTarget.name} peut maintenant vous écrire dans la messagerie locale.`, 'success');
      return;
    }

    addToast('Profil liké', `${profileTarget.name} a été conservé dans vos interactions locales.`, 'info');
  };

  const handlePass = (profileId) => {
    if (passed.includes(profileId)) {
      return;
    }

    const profileTarget = DEMO_PROFILES.find((item) => item.id === profileId);
    setPassed((current) => [...current, profileId]);
    addToast('Profil passé', `${profileTarget?.name || 'Ce profil'} a été masqué pour cette démonstration.`, 'info');
  };

  const handleOpenMessagesFromMatch = (profileId) => {
    const conversationId = messages.find((item) => item.profileId === profileId)?.id || null;
    setSelectedConversation(conversationId);
    setView('messages');
  };

  const handleSendMessage = () => {
    if (!draftMessage.trim() || !selectedConversation) {
      return;
    }

    const text = draftMessage.trim();

    setMessages((current) =>
      current.map((item) =>
        item.id === selectedConversation
          ? {
              ...item,
              updatedAt: new Date().toISOString(),
              messages: [
                ...item.messages,
                {
                  id: `msg-${Date.now()}`,
                  sender: 'me',
                  text,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : item,
      ),
    );

    setMatches((current) =>
      current.map((match) =>
        match.profileId === selectedConversationData?.profileId
          ? { ...match, lastMessage: text }
          : match,
      ),
    );

    setDraftMessage('');
    addToast('Message envoyé', 'Le message a été ajouté localement à la conversation.', 'success');
  };

  const handleReset = () => {
    resetPrototypeStorage(Object.values(STORAGE_KEYS));
    setProfile(defaultProfile);
    setProfileDraft(defaultProfile);
    setProfileErrors({});
    setLikes([]);
    setPassed([]);
    setMatches([]);
    setMessages(DEFAULT_MESSAGES);
    setSelectedConversation(DEFAULT_MESSAGES[0]?.id || null);
    setSearchTerm('');
    setCityFilter('');
    setActiveMode('all');
    setView('home');
    addToast('Prototype réinitialisé', 'Toutes les données locales de démonstration ont été effacées.', 'success');
  };

  return (
    <div className="app-shell">
      <Header
        view={view}
        onViewChange={handleViewChange}
        isMobileNavOpen={isMobileNavOpen}
        onToggleMobileNav={() => setIsMobileNavOpen((current) => !current)}
      />

      <main className="page-shell">
        <section className="info-banner">
          <div>
            <strong>Données locales et simulées</strong>
            <p>Cette démonstration fonctionne uniquement dans votre navigateur. Aucun backend, paiement, authentification réelle ou messagerie temps réel n’est fourni ici.</p>
          </div>
          <button type="button" className="secondary-button" onClick={handleReset}>Réinitialiser la démo</button>
        </section>

        {view === 'home' ? (
          <HomeView
            profile={profile}
            modes={MODES}
            matchCount={matches.length}
            remainingCount={filteredProfiles.length}
            onDiscover={() => handleViewChange('discover')}
            onOpenProfile={() => handleViewChange('profile')}
            onExploreMode={(modeId) => {
              setActiveMode(modeId);
              handleViewChange('discover');
            }}
          />
        ) : null}

        {view === 'discover' ? (
          <DiscoverView
            modes={MODES}
            activeMode={activeMode}
            searchTerm={searchTerm}
            cityFilter={cityFilter}
            filteredProfiles={filteredProfiles}
            remainingCount={filteredProfiles.length}
            onModeChange={setActiveMode}
            onSearchChange={setSearchTerm}
            onCityChange={setCityFilter}
            onLike={handleLike}
            onPass={handlePass}
          />
        ) : null}

        {view === 'matches' ? <MatchesView matches={matches} onOpenMessages={handleOpenMessagesFromMatch} /> : null}

        {view === 'messages' ? (
          <MessagesView
            messages={messages}
            selectedConversation={selectedConversation}
            selectedConversationData={selectedConversationData}
            draftMessage={draftMessage}
            onConversationChange={setSelectedConversation}
            onDraftChange={setDraftMessage}
            onSendMessage={handleSendMessage}
          />
        ) : null}

        {view === 'profile' ? (
          <ProfileView profile={profileDraft} errors={profileErrors} onChange={handleProfileDraftChange} onSubmit={handleProfileSave} />
        ) : null}
      </main>

      <Toast toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))} />
    </div>
  );
}

export default App;

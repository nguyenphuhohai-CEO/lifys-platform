import { useEffect, useMemo, useState } from 'react';
import AppHeader from './components/AppHeader';
import DiscoverView from './components/DiscoverView';
import HomeView from './components/HomeView';
import MatchesView from './components/MatchesView';
import MessagesView from './components/MessagesView';
import ProfileView from './components/ProfileView';
import ToastRegion from './components/ToastRegion';
import { DEFAULT_MESSAGES, DEMO_PROFILES, STORAGE_KEYS, defaultProfile } from './data/demo';
import {
  createConversation,
  filterProfiles,
  sanitizeMatches,
  sanitizeMessages,
  sanitizeProfile,
  sanitizeStringList,
  shouldCreateMatch,
  validateProfileInput,
} from './lib/app-utils';
import { resetPrototypeStorage, safeReadJSON, writeJSON } from './lib/storage';

const prototypeStorageKeys = Object.values(STORAGE_KEYS);

function App() {
  const [view, setView] = useState('home');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeMode, setActiveMode] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [profile, setProfile] = useState(() => sanitizeProfile(safeReadJSON(STORAGE_KEYS.profile, defaultProfile)));
  const [profileDraft, setProfileDraft] = useState(() => sanitizeProfile(safeReadJSON(STORAGE_KEYS.profile, defaultProfile)));
  const [profileErrors, setProfileErrors] = useState({});
  const [likes, setLikes] = useState(() => sanitizeStringList(safeReadJSON(STORAGE_KEYS.likes, [])));
  const [passed, setPassed] = useState(() => sanitizeStringList(safeReadJSON(STORAGE_KEYS.passed, [])));
  const [matches, setMatches] = useState(() => sanitizeMatches(safeReadJSON(STORAGE_KEYS.matches, [])));
  const [messages, setMessages] = useState(() => sanitizeMessages(safeReadJSON(STORAGE_KEYS.messages, DEFAULT_MESSAGES)));
  const [selectedConversation, setSelectedConversation] = useState(null);

  useEffect(() => {
    writeJSON(STORAGE_KEYS.profile, profile);
    writeJSON(STORAGE_KEYS.likes, likes);
    writeJSON(STORAGE_KEYS.passed, passed);
    writeJSON(STORAGE_KEYS.matches, matches);
    writeJSON(STORAGE_KEYS.messages, messages);
  }, [profile, likes, passed, matches, messages]);

  useEffect(() => {
    if (!messages.some((conversation) => conversation.id === selectedConversation)) {
      setSelectedConversation(messages[0]?.id ?? null);
    }
  }, [messages, selectedConversation]);

  const pushNotification = (title, message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotifications((current) => [...current, { id, title, message, tone }]);
    window.setTimeout(() => {
      setNotifications((current) => current.filter((notification) => notification.id !== id));
    }, 3600);
  };

  const dismissNotification = (id) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  };

  const handleNavigate = (nextView) => {
    setView(nextView);
    setMobileNavOpen(false);
  };

  const handleProfileChange = (field, value) => {
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

  const filteredProfiles = useMemo(() => {
    return filterProfiles(DEMO_PROFILES, {
      activeMode,
      likedIds: likes,
      passedIds: passed,
      profileMode: profile.mode,
      searchTerm,
      cityTerm: cityFilter,
    });
  }, [activeMode, likes, passed, profile.mode, searchTerm, cityFilter]);

  const availableCities = useMemo(() => {
    return [...new Set(DEMO_PROFILES.map((profileItem) => profileItem.city))].sort((left, right) => left.localeCompare(right));
  }, []);

  const selectedConversationData = messages.find((conversation) => conversation.id === selectedConversation) || null;

  const handleProfileSave = (event) => {
    event.preventDefault();
    const { profile: nextProfile, errors } = validateProfileInput(profileDraft);

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      pushNotification('Profil incomplet', 'Corrigez les champs signalés pour enregistrer ce profil local.', 'warning');
      return;
    }

    setProfile(nextProfile);
    setProfileDraft(nextProfile);
    setProfileErrors({});
    setView('discover');
    pushNotification('Profil enregistré', 'Votre profil de démonstration a bien été sauvegardé localement.', 'success');
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

    if (!shouldCreateMatch(profileTarget, profile)) {
      pushNotification('Like enregistré', 'Le profil a été aimé localement. Aucun match simulé pour l’instant.', 'info');
      return;
    }

    setMatches((current) => {
      if (current.some((item) => item.profileId === profileId)) {
        return current;
      }

      return [
        ...current,
        {
          id: `match-${profileId}`,
          profileId,
          name: profileTarget.name,
          city: profileTarget.city,
          mode: profileTarget.mode,
          avatar: profileTarget.avatar,
          lastMessage: 'Nouveau match simulé sur le prototype',
        },
      ];
    });

    setMessages((current) => {
      if (current.some((item) => item.profileId === profileId)) {
        return current;
      }

      return [...current, createConversation(profileTarget)];
    });

    setSelectedConversation(`conv-${profileTarget.id}`);
    pushNotification('Nouveau match', `Vous avez un match simulé avec ${profileTarget.name}.`, 'success');
  };

  const handlePass = (profileId) => {
    if (passed.includes(profileId)) {
      return;
    }

    setPassed((current) => [...current, profileId]);
  };

  const openConversation = (match) => {
    setMessages((current) => {
      if (current.some((item) => item.profileId === match.profileId)) {
        return current;
      }

      return [
        ...current,
        createConversation({
          id: match.profileId,
          name: match.name,
          city: match.city,
          mode: match.mode,
          avatar: match.avatar,
        }),
      ];
    });

    setSelectedConversation(`conv-${match.profileId}`);
    setView('messages');
  };

  const handleSendMessage = () => {
    const messageText = draftMessage.trim();
    if (!messageText || !selectedConversationData) {
      return;
    }

    const nextMessage = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text: messageText,
    };

    setMessages((current) => current.map((conversation) => (
      conversation.id === selectedConversationData.id
        ? { ...conversation, messages: [...conversation.messages, nextMessage] }
        : conversation
    )));

    setMatches((current) => current.map((match) => (
      match.profileId === selectedConversationData.profileId
        ? { ...match, lastMessage: messageText }
        : match
    )));

    setDraftMessage('');
  };

  const handleResetPrototype = () => {
    resetPrototypeStorage(prototypeStorageKeys);
    setProfile(defaultProfile);
    setProfileDraft(defaultProfile);
    setProfileErrors({});
    setLikes([]);
    setPassed([]);
    setMatches([]);
    setMessages(DEFAULT_MESSAGES);
    setDraftMessage('');
    setSelectedConversation(DEFAULT_MESSAGES[0]?.id ?? null);
    setActiveMode('all');
    setSearchTerm('');
    setCityFilter('');
    setView('home');
    pushNotification('Prototype réinitialisé', 'Les données locales simulées ont été remises à zéro.', 'success');
  };

  return (
    <div className="app-shell">
      <ToastRegion notifications={notifications} onDismiss={dismissNotification} />

      <AppHeader
        matchCount={matches.length}
        onNavigate={handleNavigate}
        view={view}
        mobileNavOpen={mobileNavOpen}
        onToggleMobileNav={() => setMobileNavOpen((current) => !current)}
      />

      <main className="page-shell">
        {view === 'home' ? (
          <HomeView
            profile={profile}
            matchCount={matches.length}
            conversationCount={messages.length}
            onModeSelect={(modeId) => {
              setActiveMode(modeId);
              setView('discover');
            }}
            onNavigate={handleNavigate}
            onReset={handleResetPrototype}
          />
        ) : null}

        {view === 'discover' ? (
          <DiscoverView
            activeMode={activeMode}
            availableCities={availableCities}
            cityFilter={cityFilter}
            filteredProfiles={filteredProfiles}
            onChangeCity={setCityFilter}
            onChangeSearch={setSearchTerm}
            onLike={handleLike}
            onPass={handlePass}
            onSelectMode={setActiveMode}
            searchTerm={searchTerm}
            totalCount={DEMO_PROFILES.length}
          />
        ) : null}

        {view === 'matches' ? (
          <MatchesView matches={matches} onMessage={openConversation} />
        ) : null}

        {view === 'messages' ? (
          <MessagesView
            conversations={messages}
            draftMessage={draftMessage}
            onChangeDraft={setDraftMessage}
            onSend={handleSendMessage}
            onSelectConversation={setSelectedConversation}
            selectedConversationId={selectedConversation}
            selectedConversation={selectedConversationData}
          />
        ) : null}

        {view === 'profile' ? (
          <ProfileView draft={profileDraft} errors={profileErrors} onChange={handleProfileChange} onSubmit={handleProfileSave} />
        ) : null}
      </main>
    </div>
  );
}

export default App;

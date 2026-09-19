import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Avatar from './components/Avatar';
import ToastRegion from './components/ToastRegion';
import { MODES, defaultProfile } from './data/demoData';
import { api, ApiError } from './lib/api';
import { getConversationPreview, getModeById, resolveSelectedConversationId, serializeInterests } from './utils/app-utils';
import { STORAGE_KEYS, resetPrototypeStorage, safeReadJSON, safeWriteJSON } from './utils/storage';

const NAV_ITEMS = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'profile', label: 'Profil' },
];

const NAV_VIEW_IDS = new Set(NAV_ITEMS.map((item) => item.id));

const PROTOTYPE_STORAGE_KEYS = [
  STORAGE_KEYS.profile,
  STORAGE_KEYS.likes,
  STORAGE_KEYS.matches,
  STORAGE_KEYS.messages,
  STORAGE_KEYS.passed,
];

const initialSessionUiState = safeReadJSON(STORAGE_KEYS.sessionUi, { view: 'home', selectedConversation: null }, {
  sanitize: (value) => ({
    view: NAV_VIEW_IDS.has(value?.view) ? value.view : 'home',
    selectedConversation: typeof value?.selectedConversation === 'string' ? value.selectedConversation : null,
  }),
});

const initialSessionUi = initialSessionUiState.data;

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
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState(initialSessionUi.view);
  const [activeMode, setActiveMode] = useState('all');
  const [profile, setProfile] = useState(defaultProfile);
  const [profileDraft, setProfileDraft] = useState(defaultProfile);
  const [profileErrors, setProfileErrors] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(initialSessionUi.selectedConversation);
  const [draftMessage, setDraftMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionBootstrapped, setSessionBootstrapped] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [emailVerificationSubmitting, setEmailVerificationSubmitting] = useState(false);
  const [passwordResetSubmitting, setPasswordResetSubmitting] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [uiPersistenceWarningShown, setUiPersistenceWarningShown] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pageError, setPageError] = useState('');
  const [passwordResetRequestEmail, setPasswordResetRequestEmail] = useState('');
  const [passwordResetForm, setPasswordResetForm] = useState({
    token: '',
    password: '',
  });
  const [passwordResetPreviewToken, setPasswordResetPreviewToken] = useState('');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [emailVerificationPreviewToken, setEmailVerificationPreviewToken] = useState('');
  const refreshRequestRef = useRef(null);

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

  const resetSessionState = useCallback((options = {}) => {
    setToken('');
    setCurrentUser(null);
    setView('home');
    setProfile(defaultProfile);
    setProfileDraft(defaultProfile);
    setProfileErrors({});
    setProfiles([]);
    setMatches([]);
    setConversations([]);
    setSelectedConversation(null);
    setDraftMessage('');
    setSearchQuery('');
    setCityQuery('');
    setActiveMode('all');
    setEmailVerificationToken('');
    setEmailVerificationPreviewToken('');
    setPasswordResetPreviewToken('');
    setUiPersistenceWarningShown(false);
    setIsMobileNavOpen(false);
    resetPrototypeStorage([STORAGE_KEYS.auth, STORAGE_KEYS.sessionUi]);

    if (options.pageError !== undefined) {
      setPageError(options.pageError);
    } else {
      setPageError('');
    }

    if (options.toast) {
      showToast(options.toast);
    }
  }, [showToast]);

  const applyAuthenticatedSession = useCallback((response, options = {}) => {
    setToken(response.token);
    setCurrentUser(response.user);
    if (options.view) {
      setView(options.view);
    }
    setPageError('');
  }, []);

  const handleUnauthorized = useCallback((error) => {
    const message = error instanceof ApiError ? error.message : 'Votre session n’est plus valide. Reconnectez-vous.';
    resetSessionState({
      pageError: message,
      toast: {
        type: 'warning',
        title: 'Session expirée',
        message,
      },
    });
  }, [resetSessionState]);

  const applyProfileState = useCallback((nextProfile) => {
    setProfile(nextProfile);
    setProfileDraft({
      ...nextProfile,
      interests: serializeInterests(nextProfile.interests),
    });
  }, []);

  useEffect(() => {
    if (!token) {
      setUiPersistenceWarningShown(false);
      resetPrototypeStorage([STORAGE_KEYS.sessionUi]);
      return;
    }

    const persisted = safeWriteJSON(STORAGE_KEYS.sessionUi, {
      view,
      selectedConversation,
    });
    if (persisted) {
      if (uiPersistenceWarningShown) {
        setUiPersistenceWarningShown(false);
      }
      return;
    }

    if (!uiPersistenceWarningShown) {
      setUiPersistenceWarningShown(true);
      showToast({
        type: 'warning',
        title: 'Vue non persistée',
        message: 'Le navigateur a refusé la persistance locale de la vue active et de la conversation sélectionnée.',
      });
    }
  }, [selectedConversation, showToast, token, uiPersistenceWarningShown, view]);

  useEffect(() => {
    resetPrototypeStorage([STORAGE_KEYS.auth]);

    if (!initialSessionUiState.recovered) {
      return;
    }

    showToast({
      type: 'warning',
      title: 'Session locale réparée',
      message: 'Des données locales corrompues ont été ignorées pour restaurer une session saine.',
    });
  }, [showToast]);

  const refreshAccessToken = useCallback(async (options = {}) => {
    if (!refreshRequestRef.current) {
      refreshRequestRef.current = api.refreshSession()
        .then((response) => {
          applyAuthenticatedSession(response, options);
          if (response.previewEmailVerificationToken) {
            setEmailVerificationPreviewToken(response.previewEmailVerificationToken);
          }
          return response.token;
        })
        .finally(() => {
          refreshRequestRef.current = null;
        });
    }

    return refreshRequestRef.current;
  }, [applyAuthenticatedSession]);

  const withFreshToken = useCallback(async (callback, options = {}) => {
    const currentToken = token || await refreshAccessToken(options.refreshView ? { view: options.refreshView } : {});

    try {
      return await callback(currentToken);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }

      const refreshedToken = await refreshAccessToken(options.refreshView ? { view: options.refreshView } : {});
      return callback(refreshedToken);
    }
  }, [refreshAccessToken, token]);

  const syncAccountData = useCallback(async () => {
    const [profileResponse, matchesResponse, conversationsResponse] = await withFreshToken((nextToken) => Promise.all([
      api.getProfile(nextToken),
      api.getMatches(nextToken),
      api.getConversations(nextToken),
    ]), { refreshView: view });

    applyProfileState(profileResponse.profile);
    setMatches(matchesResponse.matches);
    setConversations(conversationsResponse.conversations);
    setSelectedConversation((current) => resolveSelectedConversationId(conversationsResponse.conversations, current));
  }, [applyProfileState, view, withFreshToken]);

  const loadDiscovery = useCallback(async () => {
    setDiscoveryLoading(true);

    try {
      const response = await withFreshToken((nextToken) => api.getDiscovery(nextToken, {
        activeMode,
        query: searchQuery,
        city: cityQuery,
      }), { refreshView: 'discover' });
      setProfiles(response.profiles);
      setPageError('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized(error);
        return;
      }
      handleApiError(error, 'Impossible de charger la découverte.');
    } finally {
      setDiscoveryLoading(false);
    }
  }, [activeMode, cityQuery, handleApiError, handleUnauthorized, searchQuery, withFreshToken]);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);

    try {
      const [sessionData, profileData, matchesData, conversationsData, discoveryData] = await withFreshToken((nextToken) => Promise.all([
        api.getSession(nextToken),
        api.getProfile(nextToken),
        api.getMatches(nextToken),
        api.getConversations(nextToken),
        api.getDiscovery(nextToken, {
          activeMode,
          query: searchQuery,
          city: cityQuery,
        }),
      ]), { refreshView: view });

      setCurrentUser(sessionData.user);
      applyProfileState(profileData.profile);
      setMatches(matchesData.matches);
      setConversations(conversationsData.conversations);
      setProfiles(discoveryData.profiles);
      setSelectedConversation((current) => resolveSelectedConversationId(conversationsData.conversations, current));
      setPageError('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized(error);
        return;
      }
      handleApiError(error, 'Impossible de charger votre espace Lifys.');
    } finally {
      setDashboardLoading(false);
      setSessionLoading(false);
    }
  }, [activeMode, applyProfileState, cityQuery, handleApiError, handleUnauthorized, searchQuery, view, withFreshToken]);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        await refreshAccessToken();
      } catch {
        if (!cancelled) {
          setToken('');
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setSessionBootstrapped(true);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [refreshAccessToken]);

  useEffect(() => {
    if (!sessionBootstrapped) {
      return;
    }

    if (!token) {
      setSessionLoading(false);
      setCurrentUser(null);
      return;
    }

    loadDashboard();
  }, [loadDashboard, sessionBootstrapped, token]);

  useEffect(() => {
    if (currentUser && token) {
      loadDiscovery();
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
      setSelectedConversation(resolveSelectedConversationId(conversations, selectedConversation));
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

  const [authMode, setAuthMode] = useState('register');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    mode: 'amoureux',
  });

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthSubmitting(true);

    try {
      const response = authMode === 'register'
        ? await api.register(authForm)
        : await api.login({ email: authForm.email, password: authForm.password });

      applyAuthenticatedSession(response, { view: 'profile' });
      setSessionBootstrapped(true);
      setAuthForm({
        name: '',
        email: '',
        password: '',
        mode: 'amoureux',
      });
      setPasswordResetPreviewToken('');
      if (response.previewEmailVerificationToken) {
        setEmailVerificationPreviewToken(response.previewEmailVerificationToken);
        setEmailVerificationToken(response.previewEmailVerificationToken);
      }
      showToast({
        type: 'success',
        title: authMode === 'register' ? 'Compte créé' : 'Connexion réussie',
        message: authMode === 'register'
          ? 'Votre session Lifys backend est active. Vérifiez maintenant votre e-mail dans le flux local.'
          : 'Votre session Lifys backend est maintenant active.',
      });
    } catch (error) {
      handleApiError(error, 'Impossible de démarrer votre session.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleRequestEmailVerification = async () => {
    setEmailVerificationSubmitting(true);

    try {
      const response = await withFreshToken((authToken) => api.requestEmailVerification(authToken));
      if (response.previewToken) {
        setEmailVerificationPreviewToken(response.previewToken);
        setEmailVerificationToken(response.previewToken);
      }
      showToast({
        type: 'info',
        title: 'Vérification préparée',
        message: response.message,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized(error);
        return;
      }
      handleApiError(error, 'Impossible de préparer la vérification e-mail.');
    } finally {
      setEmailVerificationSubmitting(false);
    }
  };

  const handleConfirmEmailVerification = async (event) => {
    event.preventDefault();
    setEmailVerificationSubmitting(true);

    try {
      const response = await api.confirmEmailVerification(emailVerificationToken);
      setCurrentUser(response.user);
      setEmailVerificationPreviewToken('');
      showToast({
        type: 'success',
        title: 'E-mail vérifié',
        message: 'Votre adresse e-mail est maintenant confirmée pour ce MVP local.',
      });
    } catch (error) {
      handleApiError(error, 'Impossible de confirmer cet e-mail.');
    } finally {
      setEmailVerificationSubmitting(false);
    }
  };

  const handleRequestPasswordReset = async (event) => {
    event.preventDefault();
    setPasswordResetSubmitting(true);

    try {
      const response = await api.requestPasswordReset(passwordResetRequestEmail);
      setPasswordResetPreviewToken(response.previewToken ?? '');
      if (response.previewToken) {
        setPasswordResetForm((current) => ({ ...current, token: response.previewToken }));
      }
      showToast({
        type: 'info',
        title: 'Réinitialisation préparée',
        message: response.message,
      });
    } catch (error) {
      handleApiError(error, 'Impossible de préparer la réinitialisation du mot de passe.');
    } finally {
      setPasswordResetSubmitting(false);
    }
  };

  const handleConfirmPasswordReset = async (event) => {
    event.preventDefault();
    setPasswordResetSubmitting(true);

    try {
      const response = await api.confirmPasswordReset(passwordResetForm.token, passwordResetForm.password);
      applyAuthenticatedSession(response, { view: 'profile' });
      setSessionBootstrapped(true);
      setPasswordResetForm({ token: '', password: '' });
      setPasswordResetPreviewToken('');
      showToast({
        type: 'success',
        title: 'Mot de passe réinitialisé',
        message: 'Un nouveau refresh cookie et un nouvel access token ont été émis.',
      });
    } catch (error) {
      handleApiError(error, 'Impossible de réinitialiser ce mot de passe.');
    } finally {
      setPasswordResetSubmitting(false);
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
      const response = await withFreshToken((nextToken) => api.updateProfile(nextToken, profileDraft), { refreshView: 'profile' });
      applyProfileState(response.profile);
      setProfileErrors({});
      setView('discover');
      setPageError('');
      showToast({
        type: 'success',
        title: 'Profil synchronisé',
        message: 'Votre profil est maintenant enregistré côté serveur.',
      });
      await Promise.all([
        syncAccountData(),
        loadDiscovery(),
      ]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized(error);
        return;
      }
      handleApiError(error, 'Impossible de sauvegarder le profil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLike = async (profileId) => {
    try {
      const response = await withFreshToken((nextToken) => api.likeProfile(nextToken, profileId), { refreshView: 'discover' });
      await Promise.all([
        syncAccountData(),
        loadDiscovery(),
      ]);

      if (response.matched) {
        setSelectedConversation(response.conversationId);
        showToast({
          type: 'success',
          title: 'Match confirmé',
          message: 'Le backend a créé votre match et ouvert une conversation persistante.',
        });
      } else {
        showToast({
          type: 'info',
          title: 'Like enregistré',
          message: 'Votre intérêt a été sauvegardé côté serveur.',
        });
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized(error);
        return;
      }
      handleApiError(error, 'Impossible d’enregistrer ce like.');
    }
  };

  const handlePass = async (profileId) => {
    try {
      await withFreshToken((nextToken) => api.passProfile(nextToken, profileId), { refreshView: 'discover' });
      await Promise.all([
        syncAccountData(),
        loadDiscovery(),
      ]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized(error);
        return;
      }
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
      const response = await withFreshToken(
        (nextToken) => api.sendMessage(nextToken, selectedConversationData.id, text),
        { refreshView: 'messages' },
      );
      const persistedLastMessage = response.conversation.messages.at(-1)?.text ?? text.trim();
      setConversations((current) => {
        const existingConversation = current.some(
          (conversation) => conversation.id === response.conversation.id,
        );

        if (!existingConversation) {
          return [response.conversation, ...current];
        }

        return current.map((conversation) => (
          conversation.id === response.conversation.id ? response.conversation : conversation
        ));
      });
      setMatches((current) => current.map((match) => (
        match.profileId === response.conversation.profileId
          ? { ...match, lastMessage: persistedLastMessage }
          : match
      )));
      setDraftMessage('');
      setPageError('');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized(error);
        return;
      }
      handleApiError(error, 'Impossible d’envoyer le message.');
    } finally {
      setMessageSending(false);
    }
  };

  const handleResetPrototype = async () => {
    setResetting(true);

    try {
      const response = await withFreshToken((nextToken) => api.resetPrototype(nextToken), { refreshView: view });
      const nextSelectedConversation = response.conversations[0]?.id ?? null;
      const nextView = view === 'messages' && !nextSelectedConversation ? 'matches' : view;
      applyProfileState(response.profile);
      setMatches(response.matches);
      setConversations(response.conversations);
      setSelectedConversation(nextSelectedConversation);
      setView(nextView);
      setSearchQuery('');
      setCityQuery('');
      setActiveMode('all');
      setDraftMessage('');
      resetPrototypeStorage(PROTOTYPE_STORAGE_KEYS);
      const restoredSessionUi = safeWriteJSON(STORAGE_KEYS.sessionUi, {
        view: nextView,
        selectedConversation: nextSelectedConversation,
      });
      if (!restoredSessionUi) {
        showToast({
          type: 'warning',
          title: 'Vue non persistée',
          message: 'Le prototype a été réinitialisé, mais la vue et la conversation actives n’ont pas pu être restaurées localement.',
        });
      }
      await loadDiscovery();
      showToast({
        type: 'success',
        title: 'Données de démonstration réinitialisées',
        message: 'Vos interactions serveur ont été nettoyées et votre profil a été réinitialisé.',
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleUnauthorized(error);
        return;
      }
      handleApiError(error, 'Impossible de réinitialiser le prototype.');
    } finally {
      setResetting(false);
    }
  };

  const handleLogout = async () => {
    let logoutConfirmed = false;

    try {
      await api.logout();
      logoutConfirmed = true;
    } catch {
      // ignore logout transport failures, local reset still wins
    }

    resetSessionState({
      pageError: logoutConfirmed ? '' : 'La session locale a été fermée, mais la révocation serveur du refresh cookie n’a pas pu être confirmée.',
      toast: logoutConfirmed
        ? {
          type: 'info',
          title: 'Session fermée',
          message: 'Le refresh cookie sécurisé et la session locale ont été supprimés.',
        }
        : {
          type: 'warning',
          title: 'Déconnexion partielle',
          message: 'L’état local a été réinitialisé, mais la révocation serveur du refresh cookie n’a pas pu être confirmée.',
        },
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
          <p className="section-description">Initialisation de votre session, du backend Express et de la base SQLite.</p>
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
              <p className="eyebrow">Frontend React + backend Express</p>
              <h1>Lifys passe du prototype local à un MVP backend concret.</h1>
              <p>
                Les comptes, profils, matchs et conversations sont maintenant portés par le backend local.
                Les profils de découverte restent fictifs tant que la plateforme n’est pas ouverte à de vrais utilisateurs.
              </p>
              <div className="hero-metrics">
                <article className="metric-card">
                  <span>Backend</span>
                  <strong>Express</strong>
                  <small>API JSON sécurisée</small>
                </article>
                <article className="metric-card">
                  <span>Base</span>
                  <strong>SQLite</strong>
                  <small>persistante en local</small>
                </article>
                <article className="metric-card">
                  <span>Session</span>
                  <strong>httpOnly</strong>
                  <small>refresh cookie + access token</small>
                </article>
              </div>
            </div>

            <div className="content-panel auth-card">
              <SectionHeader
                eyebrow={authMode === 'register' ? 'Créer un compte' : 'Connexion'}
                title={authMode === 'register' ? 'Commencer sur Lifys' : 'Reprendre votre session'}
                description="Les comptes utilisateur sont réels dans votre instance locale. Le refresh token est stocké en cookie httpOnly ; les profils de découverte restent fictifs."
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

              <div className="profile-layout">
                <form className="profile-form" onSubmit={handleRequestPasswordReset}>
                  <SectionHeader
                    eyebrow="Mot de passe"
                    title="Préparer une réinitialisation"
                    description="Flux local de démonstration : un token de reset est généré côté backend sans envoi e-mail réel."
                  />
                  <label>
                    <span>E-mail du compte</span>
                    <input
                      type="email"
                      value={passwordResetRequestEmail}
                      onChange={(event) => setPasswordResetRequestEmail(event.target.value)}
                    />
                  </label>
                  {passwordResetPreviewToken ? <small className="section-description">Token local : {passwordResetPreviewToken}</small> : null}
                  <div className="form-actions">
                    <button type="submit" className="secondary-button" disabled={passwordResetSubmitting}>
                      {passwordResetSubmitting ? 'Préparation…' : 'Préparer le reset'}
                    </button>
                  </div>
                </form>

                <form className="profile-form" onSubmit={handleConfirmPasswordReset}>
                  <SectionHeader
                    eyebrow="Réinitialisation"
                    title="Appliquer un nouveau mot de passe"
                    description="Collez le token de démo, définissez un nouveau mot de passe, puis une nouvelle session sera ouverte."
                  />
                  <label>
                    <span>Token de reset</span>
                    <input
                      value={passwordResetForm.token}
                      onChange={(event) => setPasswordResetForm((current) => ({ ...current, token: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Nouveau mot de passe</span>
                    <input
                      type="password"
                      value={passwordResetForm.password}
                      onChange={(event) => setPasswordResetForm((current) => ({ ...current, password: event.target.value }))}
                    />
                  </label>
                  <div className="form-actions">
                    <button type="submit" className="secondary-button" disabled={passwordResetSubmitting}>
                      {passwordResetSubmitting ? 'Réinitialisation…' : 'Valider le reset'}
                    </button>
                  </div>
                </form>
              </div>
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
            <small>React + Express + SQLite</small>
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
          <strong>MVP backend local</strong>
          <span>Les comptes utilisateur, profils, matchs et messages sont persistés dans SQLite sur votre instance locale.</span>
          <span>Le refresh token est protégé par cookie httpOnly ; les profils de découverte restent fictifs et aucune identité réelle n’est encore vérifiée.</span>
        </section>

        {!currentUser.emailVerified ? (
          <section className="content-panel">
            <SectionHeader
              eyebrow="Vérification e-mail"
              title="Adresse non vérifiée"
              description="Le backend peut maintenant générer un token de vérification local. Aucun envoi d’e-mail réel n’est encore branché."
            />
            <div className="profile-layout">
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={handleRequestEmailVerification} disabled={emailVerificationSubmitting}>
                  {emailVerificationSubmitting ? 'Préparation…' : 'Préparer un token de vérification'}
                </button>
              </div>
              <form className="profile-form" onSubmit={handleConfirmEmailVerification}>
                <label>
                  <span>Token de vérification</span>
                  <input value={emailVerificationToken} onChange={(event) => setEmailVerificationToken(event.target.value)} />
                </label>
                {emailVerificationPreviewToken ? <small className="section-description">Token local : {emailVerificationPreviewToken}</small> : null}
                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={emailVerificationSubmitting || !emailVerificationToken.trim()}>
                    {emailVerificationSubmitting ? 'Validation…' : 'Confirmer mon e-mail'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

        {pageError ? <div className="form-alert" role="alert">{pageError}</div> : null}

        {view === 'home' && (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <span className="eyebrow">MVP full-stack local</span>
                <h1>Une base Lifys désormais connectée à un vrai backend.</h1>
                <p>
                  Votre profil, vos likes, vos matchs et vos messages sont servis par Express et stockés en SQLite,
                  tout en conservant une expérience premium et des profils de découverte fictifs pour la démo.
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
                    <small>retournés par l’API</small>
                  </article>
                  <article className="metric-card">
                    <span>Matchs</span>
                    <strong>{matches.length}</strong>
                    <small>persistés en base</small>
                  </article>
                  <article className="metric-card">
                    <span>Messages</span>
                    <strong>{conversations.reduce((count, conversation) => count + conversation.messages.length, 0)}</strong>
                    <small>restaurés après reload</small>
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
                  <p>JWT · SQLite · Vite</p>
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
              description="La découverte est maintenant pilotée par l’API backend et exclut les profils déjà likés ou passés."
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
              <EmptyState title="Chargement des profils" description="Le backend prépare vos recommandations." />
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
              description="Les matchs sont créés par le backend et restent disponibles au redémarrage de l’application."
            />

            {dashboardLoading ? (
              <EmptyState title="Chargement des matchs" description="Lecture des correspondances depuis SQLite." />
            ) : matches.length === 0 ? (
              <EmptyState title="Aucun match pour l’instant" description="Commencez par liker des profils pour créer vos premières connexions." actionLabel="Voir la découverte" onAction={() => setView('discover')} />
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
              <SectionHeader eyebrow="Messages" title="Conversations" description="Historique persistant avec envoi par Entrée." />

              {dashboardLoading ? (
                <EmptyState title="Chargement des conversations" description="Récupération de vos messages depuis le backend." />
              ) : conversations.length === 0 ? (
                <EmptyState title="Aucune conversation" description="Un match backend ouvre automatiquement un canal de discussion." actionLabel="Trouver un match" onAction={() => setView('discover')} />
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
                      <p className="section-description">Aucun message pour l’instant. Envoyez le premier message pour démarrer la conversation.</p>
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
                <EmptyState title="Sélectionnez une conversation" description="Choisissez un échange pour afficher les messages persistés." />
              )}
            </div>
          </section>
        )}

        {view === 'profile' && (
          <section className="content-panel profile-panel">
            <SectionHeader eyebrow="Profil" title="Complétez votre profil" description="Les mises à jour sont validées puis synchronisées vers le backend." />

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

import { useCallback, useEffect, useMemo, useState } from 'react';

import Avatar from './components/Avatar';
import SiteFooter from './components/SiteFooter';
import PricingPanel, { AdSlot } from './components/Pricing';
import ToastRegion from './components/ToastRegion';
import { MODES, defaultProfile } from './data/demoData';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useI18n } from './i18n';
import { api, ApiError } from './lib/api';
import { getConversationPreview, getModeById, serializeInterests } from './utils/app-utils';
import { getCategoryPath, getModeFromSearch, navigate } from './utils/routing';
import { STORAGE_KEYS, resetPrototypeStorage, safeReadJSON, safeWriteJSON } from './utils/storage';

const NAV_ITEMS = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'pricing', label: 'Offres' },
  { id: 'profile', label: 'Profil' },
];

const initialAuth = safeReadJSON(STORAGE_KEYS.auth, { token: '' }, {
  sanitize: (value) => ({
    token: typeof value?.token === 'string' ? value.token : '',
  }),
}).data;

function translateReasonWith(t, reason) {
  const patterns = [
    [/^Même intention : (.+)\.$/, 'Même intention : {value}.'],
    [/^Même ville : (.+)\.$/, 'Même ville : {value}.'],
    [/^Centre d’intérêt partagé : (.+)\.$/, 'Centre d’intérêt partagé : {value}.'],
  ];
  for (const [pattern, key] of patterns) {
    const found = typeof reason === 'string' ? reason.match(pattern) : null;
    if (found) {
      const value = key.startsWith('Même intention') ? t(found[1].charAt(0).toUpperCase() + found[1].slice(1)) : found[1];
      return t(key, { value });
    }
  }
  return t(reason);
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
  const { lang, t } = useI18n();
  const [token, setToken] = useState(initialAuth.token);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('home');
  const [activeMode, setActiveMode] = useState(() => getModeFromSearch(window.location.search) ?? 'all');
  const [profile, setProfile] = useState(defaultProfile);
  const [profileDraft, setProfileDraft] = useState(defaultProfile);
  const [profileErrors, setProfileErrors] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [toasts, setToasts] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pageError, setPageError] = useState('');
  const [authMode, setAuthMode] = useState('register');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    mode: 'amoureux',
    acceptTerms: false,
  });
  const [plans, setPlans] = useState([]);
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('spam');

  const translateReason = (reason) => translateReasonWith(t, reason);

  const showToast = useCallback((toast) => {
    const id = `${toast.type}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    setToasts((current) => [...current, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const handleApiError = useCallback((error, fallbackMessage) => {
    const message = t(error instanceof ApiError ? error.message : fallbackMessage);
    setPageError(message);
    showToast({
      type: 'warning',
      title: t('Action interrompue'),
      message,
    });
  }, [showToast, t]);

  useEffect(() => {
    if (token) {
      safeWriteJSON(STORAGE_KEYS.auth, { token });
    } else {
      resetPrototypeStorage([STORAGE_KEYS.auth]);
    }
  }, [token]);

  const loadDiscovery = useCallback(async (authToken) => {
    setDiscoveryLoading(true);

    try {
      const response = await api.getDiscovery(authToken, {
        activeMode,
        query: searchQuery,
        city: cityQuery,
      });
      setProfiles(response.profiles);
      setPageError('');
    } catch (error) {
      handleApiError(error, t('Impossible de charger la découverte.'));
    } finally {
      setDiscoveryLoading(false);
    }
  }, [activeMode, cityQuery, handleApiError, searchQuery]);

  const loadDashboard = useCallback(async (authToken) => {
    setDashboardLoading(true);

    try {
      const [sessionData, bootstrapData, discoveryData] = await Promise.all([
        api.getSession(authToken),
        api.getBootstrap(authToken),
        api.getDiscovery(authToken, {
          activeMode,
          query: searchQuery,
          city: cityQuery,
        }).catch((error) => {
          if (error instanceof ApiError && error.details?.code === 'email_not_verified') {
            return { profiles: [] };
          }
          throw error;
        }),
      ]);

      setCurrentUser(sessionData.user);
      setProfile(bootstrapData.profile);
      setProfileDraft({
        ...bootstrapData.profile,
        interests: serializeInterests(bootstrapData.profile.interests),
      });
      setMatches(bootstrapData.matches);
      setConversations(bootstrapData.conversations);
      setProfiles(discoveryData.profiles);
      setSelectedConversation((current) => (
        bootstrapData.conversations.some((conversation) => conversation.id === current)
          ? current
          : bootstrapData.conversations[0]?.id ?? null
      ));
      setPageError('');
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.details?.code === 'account_suspended')) {
        setToken('');
        setCurrentUser(null);
      }
      handleApiError(error, t('Impossible de charger votre espace Lifys.'));
    } finally {
      setDashboardLoading(false);
      setSessionLoading(false);
    }
  }, [activeMode, cityQuery, handleApiError, searchQuery]);

  useEffect(() => {
    if (!token) {
      setSessionLoading(false);
      setCurrentUser(null);
      return;
    }

    loadDashboard(token);
  }, [loadDashboard, token]);

  useEffect(() => {
    if (currentUser && token) {
      loadDiscovery(token);
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
      setSelectedConversation(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedConversation]);

  const isPremium = currentUser?.profile?.plan === 'premium';

  useEffect(() => {
    api.getPlans().then((data) => {
      setPlans(data.plans);
      setCheckoutAvailable(data.checkoutAvailable);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const billing = new URLSearchParams(window.location.search).get('billing');
    if (billing && currentUser) {
      window.history.replaceState({}, '', window.location.pathname);
      setView('pricing');
      showToast(billing === 'success'
        ? { type: 'success', title: t('Paiement reçu'), message: t('Votre abonnement Premium sera activé dans quelques instants.') }
        : { type: 'info', title: t('Paiement annulé'), message: t('Aucun montant n’a été prélevé.') });
      if (billing === 'success') {
        window.setTimeout(() => loadDashboard(token), 3000);
      }
    }
  }, [currentUser, loadDashboard, showToast, t, token]);

  const redirectToBilling = async (request) => {
    setBillingBusy(true);
    try {
      const { url } = await request(token);
      window.location.assign(url);
    } catch (error) {
      handleApiError(error, t('Le paiement n’est pas encore disponible.'));
      setBillingBusy(false);
    }
  };

  const selectedConversationData = conversations.find((conversation) => conversation.id === selectedConversation) ?? null;
  const availableCities = useMemo(() => [...new Set(profiles.map((item) => item.city).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [profiles]);
  const completedProfile = Boolean(profile.name && profile.age && profile.city && profile.bio);

  const validateProfile = () => {
    const errors = {};

    if (!profileDraft.name.trim()) {
      errors.name = t('Ajoutez votre prénom.');
    }
    if (!profileDraft.age || Number(profileDraft.age) < 18 || Number(profileDraft.age) > 80) {
      errors.age = t('Indiquez un âge entre 18 et 80 ans.');
    }
    if (!profileDraft.city.trim()) {
      errors.city = t('Ajoutez une ville.');
    }
    if (profileDraft.bio.trim().length < 20) {
      errors.bio = t('Décrivez-vous en au moins 20 caractères.');
    }
    if (profileDraft.avatar && !/^https?:\/\//i.test(profileDraft.avatar.trim())) {
      errors.avatar = t('Utilisez une URL commençant par http:// ou https://.');
    }

    return errors;
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthSubmitting(true);

    try {
      const response = authMode === 'register'
        ? await api.register({ ...authForm, lang })
        : await api.login({ email: authForm.email, password: authForm.password });

      setToken(response.token);
      setCurrentUser(response.user);
      setView('profile');
      showToast({
        type: 'success',
        title: authMode === 'register' ? t('Compte créé') : t('Connexion réussie'),
        message: t('Bienvenue sur Lifys !'),
      });
      setPageError('');
    } catch (error) {
      handleApiError(error, t('Impossible de démarrer votre session.'));
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    const errors = validateProfile();
    setProfileErrors(errors);

    if (Object.keys(errors).length) {
      showToast({
        type: 'warning',
        title: t('Profil incomplet'),
        message: t('Corrigez les champs signalés avant l’enregistrement.'),
      });
      return;
    }

    setProfileSaving(true);

    try {
      const response = await api.updateProfile(token, profileDraft);
      setProfile(response.profile);
      setProfileDraft({
        ...response.profile,
        interests: serializeInterests(response.profile.interests),
      });
      setProfileErrors({});
      setView('discover');
      setPageError('');
      showToast({
        type: 'success',
        title: t('Profil synchronisé'),
        message: t('Votre profil a bien été enregistré.'),
      });
      await loadDiscovery(token);
    } catch (error) {
      handleApiError(error, t('Impossible de sauvegarder le profil.'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleLike = async (profileId) => {
    try {
      const response = await api.likeProfile(token, profileId);
      await loadDashboard(token);

      if (response.matched) {
        setSelectedConversation(response.conversationId);
        showToast({
          type: 'success',
          title: t('Match confirmé'),
          message: t('Vous pouvez maintenant discuter ensemble.'),
        });
      } else {
        showToast({
          type: 'info',
          title: t('Like enregistré'),
          message: t('Votre intérêt a bien été enregistré.'),
        });
      }
    } catch (error) {
      handleApiError(error, t('Impossible d’enregistrer ce like.'));
    }
  };

  const handlePass = async (profileId) => {
    try {
      await api.passProfile(token, profileId);
      await loadDiscovery(token);
    } catch (error) {
      handleApiError(error, t('Impossible d’enregistrer ce pass.'));
    }
  };

  const handleSendMessage = async () => {
    const text = draftMessage.trim();
    if (!text || !selectedConversationData) {
      return;
    }

    setMessageSending(true);

    try {
      const response = await api.sendMessage(token, selectedConversationData.id, text);
      setConversations((current) => current.map((conversation) => (
        conversation.id === response.conversation.id ? response.conversation : conversation
      )));
      setDraftMessage('');
      setPageError('');
    } catch (error) {
      handleApiError(error, t('Impossible d’envoyer le message.'));
    } finally {
      setMessageSending(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await api.resendVerification(token, lang);
      showToast({ type: 'success', title: t('E-mail envoyé'), message: t('Consultez votre boîte de réception pour confirmer votre adresse.') });
    } catch (error) {
      handleApiError(error, t('Impossible d’envoyer l’e-mail de confirmation.'));
    }
  };

  const handleReport = async () => {
    if (!reportTarget) {
      return;
    }

    try {
      await api.reportProfile(token, { profileId: reportTarget.id, reason: reportReason });
      showToast({ type: 'success', title: t('Signalement envoyé'), message: t('Merci, notre équipe va examiner ce profil.') });
      setReportTarget(null);
    } catch (error) {
      handleApiError(error, t('Impossible d’envoyer le signalement.'));
    }
  };

  const handleBlock = async (person) => {
    if (!window.confirm(t('Bloquer {name} ? Vous ne vous verrez plus mutuellement.', { name: person.name }))) {
      return;
    }

    try {
      await api.blockProfile(token, person.id);
      await loadDashboard(token);
      showToast({ type: 'success', title: t('Profil bloqué'), message: t('{name} n’apparaîtra plus dans vos résultats.', { name: person.name }) });
    } catch (error) {
      handleApiError(error, t('Impossible de bloquer ce profil.'));
    }
  };

  const handleExportAccount = async () => {
    try {
      const data = await api.exportAccount(token);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'lifys-donnees.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      handleApiError(error, t('Impossible d’exporter vos données.'));
    }
  };

  const handleDeleteAccount = async () => {
    const password = window.prompt(t('Cette action est définitive. Saisissez votre mot de passe pour supprimer votre compte :'));
    if (!password) {
      return;
    }

    try {
      await api.deleteAccount(token, password);
      handleLogout();
      showToast({ type: 'success', title: t('Compte supprimé'), message: t('Vos données ont été effacées.') });
    } catch (error) {
      handleApiError(error, t('Impossible de supprimer le compte.'));
    }
  };

  const handleResetPrototype = async () => {
    setResetting(true);

    try {
      const response = await api.resetPrototype(token);
      setProfile(response.profile);
      setProfileDraft({
        ...response.profile,
        interests: serializeInterests(response.profile.interests),
      });
      setMatches(response.matches);
      setConversations(response.conversations);
      setSelectedConversation(response.conversations[0]?.id ?? null);
      setSearchQuery('');
      setCityQuery('');
      setActiveMode('all');
      setDraftMessage('');
      await loadDiscovery(token);
      showToast({
        type: 'success',
        title: t('Espace réinitialisé'),
        message: t('Vos interactions ont été effacées et votre profil réinitialisé.'),
      });
    } catch (error) {
      handleApiError(error, t('Impossible de réinitialiser le prototype.'));
    } finally {
      setResetting(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    setCurrentUser(null);
    setProfile(defaultProfile);
    setProfileDraft(defaultProfile);
    setProfiles([]);
    setMatches([]);
    setConversations([]);
    setSelectedConversation(null);
    setDraftMessage('');
    setPageError('');
    showToast({
      type: 'info',
      title: t('Session fermée'),
      message: t('À bientôt sur Lifys !'),
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
          <p className="eyebrow">{t('Chargement')}</p>
          <h1>{t('Lifys prépare votre espace…')}</h1>
          <p className="section-description">{t('Chargement de votre session…')}</p>
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
              <p className="eyebrow">{t('Rencontres multi-catégories')}</p>
              <h1>{t('Des rencontres qui vous ressemblent.')}</h1>
              <p>{t('Amitié, amour, rencontres spontanées, mariage ou réseau professionnel : choisissez l’intention qui vous correspond et rencontrez des personnes qui la partagent.')}</p>
              <div className="category-links">
                {MODES.map((mode) => (
                  <a
                    key={mode.id}
                    href={getCategoryPath(mode.id)}
                    className="pill"
                    onClick={(event) => { event.preventDefault(); navigate(getCategoryPath(mode.id)); }}
                  >
                    {mode.icon} {t(mode.label)}
                  </a>
                ))}
              </div>
              <div className="hero-metrics">
                <article className="metric-card">
                  <span>{t('5 catégories')}</span>
                  <strong>{t('Votre intention')}</strong>
                  <small>{t('chaque rencontre commence par un objectif clair')}</small>
                </article>
                <article className="metric-card">
                  <span>{t('Confidentialité')}</span>
                  <strong>{t('Vos données')}</strong>
                  <small>{t('jamais d’identifiant interne exposé aux autres')}</small>
                </article>
                <article className="metric-card">
                  <span>{t('Échanges')}</span>
                  <strong>{t('Messagerie')}</strong>
                  <small>{t('discutez dès qu’un match se crée')}</small>
                </article>
              </div>
            </div>

            <div className="content-panel auth-card">
              <SectionHeader
                eyebrow={authMode === 'register' ? t('Créer un compte') : t('Connexion')}
                title={authMode === 'register' ? t('Commencer sur Lifys') : t('Reprendre votre session')}
                description={t('Créez votre compte en quelques secondes. Une confirmation par e-mail est nécessaire pour accéder aux rencontres.')}
              />

              {pageError ? <div className="form-alert" role="alert">{pageError}</div> : null}

              <form className="profile-form" onSubmit={handleAuthSubmit}>
                {authMode === 'register' ? (
                  <label>
                    <span>{t('Prénom')}</span>
                    <input value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} />
                  </label>
                ) : null}
                <label>
                  <span>{t('E-mail')}</span>
                  <input type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} />
                </label>
                <label>
                  <span>{t('Mot de passe')}</span>
                  <input type="password" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} />
                </label>
                {authMode === 'register' ? (
                  <label>
                    <span>{t('Catégorie principale')}</span>
                    <select value={authForm.mode} onChange={(event) => setAuthForm((current) => ({ ...current, mode: event.target.value }))}>
                      {MODES.map((mode) => <option key={mode.id} value={mode.id}>{t(mode.label)}</option>)}
                    </select>
                  </label>
                ) : null}
                {authMode === 'register' ? (
                  <label className="consent-row">
                    <input
                      type="checkbox"
                      checked={authForm.acceptTerms}
                      onChange={(event) => setAuthForm((current) => ({ ...current, acceptTerms: event.target.checked }))}
                    />
                    <span>
                      {t('J’ai au moins 18 ans et j’accepte les')} <a href="/cgu" target="_blank" rel="noreferrer">{t('CGU')}</a> {t('et la')} <a href="/confidentialite" target="_blank" rel="noreferrer">{t('politique de confidentialité')}</a>.
                    </span>
                  </label>
                ) : null}
                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={authSubmitting || (authMode === 'register' && !authForm.acceptTerms)}>
                    {authSubmitting ? t('Chargement…') : authMode === 'register' ? t('Créer mon compte') : t('Se connecter')}
                  </button>
                  <button type="button" className="secondary-button" onClick={() => setAuthMode((current) => current === 'register' ? 'login' : 'register')}>
                    {authMode === 'register' ? t('J’ai déjà un compte') : t('Créer un nouveau compte')}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </main>
        <SiteFooter />
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
            <strong>{t('Lifys')}</strong>
            <small>{t('Rencontres multi-catégories')}</small>
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

        <nav id="lifys-main-nav" className={isMobileNavOpen ? 'nav nav-open' : 'nav'} aria-label={t('Navigation principale')}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? 'nav-button active' : 'nav-button'}
              onClick={() => setCurrentView(item.id)}
            >
              {t(item.label)}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <LanguageSwitcher />
          {isPremium ? <span className="tag">{t('Premium')}</span> : null}
          <span className="prototype-badge">{currentUser.email}</span>
          <button type="button" className="secondary-button" onClick={handleResetPrototype} disabled={resetting}>
            {resetting ? t('Réinitialisation…') : t('Réinitialiser')}
          </button>
          <button type="button" className="secondary-button" onClick={handleLogout}>
            {t('Déconnexion')}
          </button>
        </div>
      </header>

      <main className="page-shell">
        <section className="local-notice" aria-label={t('Information')}>
          <strong>{t('Version bêta')}</strong>
          <span>{t('Lifys ne vérifie pas l’identité de ses membres : restez prudent et signalez tout comportement abusif.')}</span>
        </section>

        {currentUser.emailVerified === false ? (
          <section className="local-notice verify-notice" aria-label={t('Confirmation de l’e-mail')}>
            <strong>{t('Confirmez votre e-mail')}</strong>
            <span>{t('Un lien de confirmation a été envoyé à {email}. Il est requis pour découvrir des profils et écrire.', { email: currentUser.email })}</span>
            <button type="button" className="secondary-button" onClick={handleResendVerification}>{t('Renvoyer l’e-mail')}</button>
          </section>
        ) : null}

        {pageError ? <div className="form-alert" role="alert">{pageError}</div> : null}

        {view === 'home' && (
          <>
            <section className="hero-panel">
              <div className="hero-copy">
                <span className="eyebrow">{t('Bienvenue sur Lifys')}</span>
                <h1>{t('Rencontrez les bonnes personnes, pour la bonne raison.')}</h1>
                <p>{t('Choisissez votre catégorie, découvrez des profils compatibles et échangez dès qu’un match se crée.')}</p>

                <div className="cta-row">
                  <button type="button" className="primary-button" onClick={() => setCurrentView('discover')}>{t('Découvrir les profils')}</button>
                  <button type="button" className="secondary-button" onClick={() => setCurrentView('profile')}>
                    {completedProfile ? t('Modifier mon profil') : t('Compléter mon profil')}
                  </button>
                </div>

                <div className="hero-metrics">
                  <article className="metric-card">
                    <span>{t('Profils')}</span>
                    <strong>{profiles.length}</strong>
                    <small>{t('correspondant à vos filtres')}</small>
                  </article>
                  <article className="metric-card">
                    <span>{t('Matchs')}</span>
                    <strong>{matches.length}</strong>
                    <small>{t('personnes en commun')}</small>
                  </article>
                  <article className="metric-card">
                    <span>{t('Messages')}</span>
                    <strong>{conversations.reduce((count, conversation) => count + conversation.messages.length, 0)}</strong>
                    <small>{t('échangés')}</small>
                  </article>
                </div>
              </div>

              <div className="hero-visual">
                <div className="mini-card large">
                  <span className="mini-label">{t('Catégorie active')}</span>
                  <h3>{t(getModeById(profile.mode || 'amoureux').label)}</h3>
                  <p>{profile.city || t('Ville à compléter')} · {profile.age || '18+'} {t('ans')}</p>
                </div>
                <div className="mini-card">
                  <span className="mini-label">{t('Compte')}</span>
                  <strong>{completedProfile ? t('Actif') : t('À compléter')}</strong>
                  <p>{currentUser.email}</p>
                </div>
                <div className="mini-card">
                  <span className="mini-label">{t('Catégories')}</span>
                  <strong>{t('5 façons de rencontrer')}</strong>
                  <p>{MODES.map((item) => t(item.label)).join(' · ')}</p>
                </div>
              </div>
            </section>

            {!isPremium ? <AdSlot onUpgrade={() => setCurrentView('pricing')} /> : null}

            <section className="mode-grid" aria-label={t('Choix de catégorie')}>
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
                  <strong>{t(mode.label)}</strong>
                  <small>{t(mode.description)}</small>
                </button>
              ))}
            </section>
          </>
        )}

        {view === 'discover' && (
          <section className="content-panel">
            <SectionHeader
              eyebrow={t('Découverte')}
              title={t('Profils recommandés')}
              description={t('Des profils sélectionnés selon vos critères, hors profils déjà likés ou passés.')}
              aside={(
                <div className="header-meta">
                  <span className="counter-badge">{discoveryLoading ? t('Chargement…') : t(profiles.length > 1 ? '{count} profils' : '{count} profil', { count: profiles.length })}</span>
                </div>
              )}
            />

            {!isPremium ? <AdSlot onUpgrade={() => setCurrentView('pricing')} /> : null}

            <div className="discover-toolbar">
              <div className="mode-pills" aria-label={t('Filtre par catégorie')}>
                <button type="button" className={activeMode === 'all' ? 'pill active' : 'pill'} onClick={() => setActiveMode('all')}>{t('Tous')}</button>
                {MODES.map((mode) => (
                  <button type="button" key={mode.id} className={activeMode === mode.id ? 'pill active' : 'pill'} onClick={() => setActiveMode(mode.id)}>
                    {t(mode.label)}
                  </button>
                ))}
              </div>

              <div className="filter-grid">
                <label>
                  <span>{t('Recherche texte')}</span>
                  <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('Nom, bio, intérêt…')} />
                </label>
                <label>
                  <span>{t('Ville')}</span>
                  <input type="search" list="lifys-city-options" value={cityQuery} onChange={(event) => setCityQuery(event.target.value)} placeholder={t('Paris, Lyon…')} />
                  <datalist id="lifys-city-options">
                    {availableCities.map((city) => <option key={city} value={city} />)}
                  </datalist>
                </label>
              </div>
            </div>

            {discoveryLoading ? (
              <EmptyState title={t('Chargement des profils')} description={t('Nous préparons vos recommandations.')} />
            ) : profiles.length === 0 ? (
              <EmptyState
                title={t('Aucun profil disponible')}
                description={t('Essayez une autre catégorie, élargissez vos filtres ou réinitialisez vos interactions.')}
                actionLabel={t('Effacer les filtres')}
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
                          <p className="city-line">📍 {person.city || t('Ville non précisée')}</p>
                        </div>
                        <span className="tag">{t(getModeById(person.mode).label)}</span>
                      </div>
                      <p>{person.bio || t('Profil en cours de complétion.')}</p>
                      <div className="interest-row">
                        {(person.interests.length ? person.interests : ['profil']).map((item) => (
                          <span key={`${person.id}-${item}`}>{item}</span>
                        ))}
                      </div>
                    </div>
                    <div className="card-actions">
                      <button type="button" className="pass-button" onClick={() => handlePass(person.id)}>{t('Pass')}</button>
                      <button type="button" className="like-button" onClick={() => handleLike(person.id)}>{t('Like')}</button>
                    </div>
                    <div className="card-actions card-safety">
                      <button type="button" className="link-button" onClick={() => { setReportTarget(person); setReportReason('spam'); }}>{t('Signaler')}</button>
                      <button type="button" className="link-button" onClick={() => handleBlock(person)}>{t('Bloquer')}</button>
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
              eyebrow={t('Matchs')}
              title={t('Vos correspondances')}
              description={t('Retrouvez ici toutes les personnes avec qui vous avez matché.')}
            />

            {dashboardLoading ? (
              <EmptyState title={t('Chargement des matchs')} description={t('Chargement de vos correspondances.')} />
            ) : matches.length === 0 ? (
              <EmptyState title={t('Aucun match pour l’instant')} description={t('Commencez par liker des profils pour créer vos premières connexions.')} actionLabel={t('Voir la découverte')} onAction={() => setCurrentView('discover')} />
            ) : (
              <div className="matches-list">
                {!isPremium ? <AdSlot onUpgrade={() => setCurrentView('pricing')} /> : null}
                {matches.map((match) => (
                  <article key={match.id} className="match-item">
                    <Avatar className="match-avatar" src={match.avatar} alt={match.name} fallback={match.name} />
                    <div className="match-copy">
                      <h3>{match.name}</h3>
                      <p>{match.city || t('Ville non précisée')} · {t(getModeById(match.mode).label)}</p>
                      <small>{translateReason(match.reason)}</small>
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
              <SectionHeader eyebrow={t('Messages')} title={t('Conversations')} description={t('Retrouvez vos échanges. Envoi avec Entrée.')} />

              {dashboardLoading ? (
                <EmptyState title={t('Chargement des conversations')} description={t('Chargement de vos messages.')} />
              ) : conversations.length === 0 ? (
                <EmptyState title={t('Aucune conversation')} description={t('Un match ouvre automatiquement un canal de discussion.')} actionLabel={t('Trouver un match')} onAction={() => setCurrentView('discover')} />
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
                        <small>{t(getConversationPreview(conversation))}</small>
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
                      <small>{t(getModeById(selectedConversationData.mode).label)}</small>
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
                      placeholder={t('Écrire un message…')}
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
                      {messageSending ? t('Envoi…') : t('Envoyer')}
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyState title={t('Sélectionnez une conversation')} description={t('Choisissez un échange pour afficher les messages.')} />
              )}
            </div>
          </section>
        )}

        {view === 'pricing' && (
          <section className="content-panel">
            <SectionHeader
              eyebrow={t('Offres')}
              title={t('Choisissez votre formule')}
              description={t('Restez gratuitement avec des publicités, ou passez à Premium pour une expérience sans publicité.')}
            />
            <PricingPanel
              plans={plans}
              checkoutAvailable={checkoutAvailable}
              isPremium={isPremium}
              busy={billingBusy}
              onCheckout={() => redirectToBilling(api.startCheckout)}
              onManage={() => redirectToBilling(api.openBillingPortal)}
            />
          </section>
        )}

        {view === 'profile' && (
          <section className="content-panel profile-panel">
            <SectionHeader eyebrow={t('Profil')} title={t('Complétez votre profil')} description={t('Vos informations sont visibles par les autres membres, sauf votre e-mail.')} />

            <div className="profile-layout">
              <form className="profile-form" onSubmit={handleProfileSave} noValidate>
                {Object.keys(profileErrors).length ? <div className="form-alert" role="alert">{t('Corrigez les champs signalés avant de sauvegarder.')}</div> : null}

                <div className="form-grid">
                  <label>
                    <span>{t('Prénom')}</span>
                    <input value={profileDraft.name} onChange={(event) => updateProfileField('name', event.target.value)} aria-invalid={Boolean(profileErrors.name)} />
                    {profileErrors.name ? <small className="field-error">{profileErrors.name}</small> : null}
                  </label>
                  <label>
                    <span>{t('Âge')}</span>
                    <input type="number" min="18" max="80" value={profileDraft.age ?? ''} onChange={(event) => updateProfileField('age', event.target.value)} aria-invalid={Boolean(profileErrors.age)} />
                    {profileErrors.age ? <small className="field-error">{profileErrors.age}</small> : null}
                  </label>
                  <label>
                    <span>{t('Ville')}</span>
                    <input value={profileDraft.city} onChange={(event) => updateProfileField('city', event.target.value)} aria-invalid={Boolean(profileErrors.city)} />
                    {profileErrors.city ? <small className="field-error">{profileErrors.city}</small> : null}
                  </label>
                  <label>
                    <span>{t('Catégorie principale')}</span>
                    <select value={profileDraft.mode} onChange={(event) => updateProfileField('mode', event.target.value)}>
                      {MODES.map((mode) => <option key={mode.id} value={mode.id}>{t(mode.label)}</option>)}
                    </select>
                  </label>
                </div>

                <label>
                  <span>{t('Photo (URL)')}</span>
                  <input value={profileDraft.avatar} onChange={(event) => updateProfileField('avatar', event.target.value)} aria-invalid={Boolean(profileErrors.avatar)} />
                  {profileErrors.avatar ? <small className="field-error">{profileErrors.avatar}</small> : null}
                </label>

                <label>
                  <span>{t('Bio')}</span>
                  <textarea rows="5" value={profileDraft.bio} onChange={(event) => updateProfileField('bio', event.target.value)} aria-invalid={Boolean(profileErrors.bio)} />
                  {profileErrors.bio ? <small className="field-error">{profileErrors.bio}</small> : null}
                </label>

                <label>
                  <span>{t('Centres d’intérêt')}</span>
                  <input
                    value={profileDraft.interests}
                    onChange={(event) => updateProfileField('interests', event.target.value)}
                    onBlur={(event) => updateProfileField('interests', serializeInterests(event.target.value))}
                    placeholder={t('Voyage, Musique, Sport')}
                  />
                </label>

                <div className="form-actions">
                  <button type="submit" className="primary-button" disabled={profileSaving}>
                    {profileSaving ? t('Synchronisation…') : t('Sauvegarder le profil')}
                  </button>
                </div>
              </form>

              <aside className="profile-preview">
                <p className="eyebrow">{t('Aperçu')}</p>
                <Avatar className="profile-preview-avatar" src={profileDraft.avatar} alt={profileDraft.name || t('Votre profil')} fallback={profileDraft.name || 'Lifys'} />
                <h3>{profileDraft.name || t('Votre prénom')}</h3>
                <p>{profileDraft.city || 'Ville'} · {profileDraft.age || '18+'} ans</p>
                <span className="tag">{getModeById(profileDraft.mode).label}</span>
                <p className="profile-preview-bio">{profileDraft.bio || t('Votre bio apparaîtra ici une fois complétée.')}</p>
                <div className="interest-row">
                  {(profileDraft.interests ? profileDraft.interests.split(',').map((item) => item.trim()).filter(Boolean) : [t('Ajoutez vos centres d’intérêt')]).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </aside>
            </div>

            <div className="account-panel">
              <h3>{t('Mes données')}</h3>
              <p>{t('Téléchargez vos données ou supprimez définitivement votre compte.')}</p>
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={handleExportAccount}>{t('Télécharger mes données')}</button>
                <button type="button" className="danger-button" onClick={handleDeleteAccount}>{t('Supprimer mon compte')}</button>
              </div>
            </div>
          </section>
        )}
      </main>

      {reportTarget ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('Signaler un profil')}>
          <div className="modal-card">
            <h3>{t('Signaler {name}', { name: reportTarget.name })}</h3>
            <label>
              <span>{t('Motif')}</span>
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                <option value="spam">{t('Spam ou publicité')}</option>
                <option value="harcelement">{t('Harcèlement')}</option>
                <option value="faux-profil">{t('Faux profil ou arnaque')}</option>
                <option value="contenu-inapproprie">{t('Contenu inapproprié')}</option>
                <option value="mineur">{t('Personne mineure')}</option>
                <option value="autre">{t('Autre')}</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="button" className="primary-button" onClick={handleReport}>{t('Envoyer')}</button>
              <button type="button" className="secondary-button" onClick={() => setReportTarget(null)}>{t('Annuler')}</button>
            </div>
          </div>
        </div>
      ) : null}

      <SiteFooter />
    </div>
  );
}

export default App;

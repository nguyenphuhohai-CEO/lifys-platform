import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Avatar from './components/Avatar';
import { DetailChips, SiteFieldsForm } from './components/SiteFields';
import SiteFooter from './components/SiteFooter';
import PricingPanel, { AdSlot } from './components/Pricing';
import ConsentBanner from './components/ConsentBanner';
import ToastRegion from './components/ToastRegion';
import { defaultProfile } from './data/demoData';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useI18n } from './i18n';
import { api, ApiError } from './lib/api';
import { getConversationPreview, getModeById, serializeInterests } from './utils/app-utils';
import { CATEGORY_CONTENT, SITES, getSite } from './data/sites';
import { getCategoryPath, navigate } from './utils/routing';
import { STORAGE_KEYS, resetPrototypeStorage, safeReadJSON, safeWriteJSON } from './utils/storage';

const NAV_ITEMS = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'pricing', label: 'Offres' },
  { id: 'profile', label: 'Profil' },
];

const getAuthKey = (site) => `${STORAGE_KEYS.auth}-${site}`;

function readStoredToken(site) {
  return safeReadJSON(getAuthKey(site), { token: '' }, {
    sanitize: (value) => ({
      token: typeof value?.token === 'string' ? value.token : '',
    }),
  }).data.token;
}

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

function App({ site }) {
  const { lang, t } = useI18n();
  const siteInfo = getSite(site);
  const authKey = getAuthKey(site);
  const content = CATEGORY_CONTENT[site];
  const [token, setToken] = useState(() => readStoredToken(site));
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('home');
  const activeMode = site;
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
  const [ageRange, setAgeRange] = useState({ min: '', max: '' });
  const [detailQuery, setDetailQuery] = useState('');
  const [tonightOnly, setTonightOnly] = useState(false);
  const [hookFor, setHookFor] = useState(null);
  const [hookText, setHookText] = useState('');
  const filtersPrefilled = useRef(false);
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
    acceptTerms: false,
  });
  const [plans, setPlans] = useState([]);
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);
  const [ads, setAds] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
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
      safeWriteJSON(authKey, { token });
    } else {
      resetPrototypeStorage([authKey]);
    }
  }, [authKey, token]);

  // Pré-remplit la recherche avec la ville du profil, une seule fois par session.
  useEffect(() => {
    if (filtersPrefilled.current || !profile.city) return;
    filtersPrefilled.current = true;
    setCityQuery(profile.city);
  }, [profile.city]);

  // Compte unique : une session ouverte sur un autre site Lifys ouvre automatiquement celui-ci.
  useEffect(() => {
    if (token) return undefined;
    let cancelled = false;
    const otherToken = Object.keys(SITES).filter((id) => id !== site).map(readStoredToken).find(Boolean);
    if (!otherToken) return undefined;
    api.switchSite(otherToken, site).then((response) => {
      if (!cancelled) setToken(response.token);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [site, token]);

  const handleSiteChange = async (nextSite) => {
    if (!nextSite || nextSite === site) return;
    try {
      const response = await api.switchSite(token, nextSite);
      safeWriteJSON(getAuthKey(nextSite), { token: response.token });
      navigate(getCategoryPath(nextSite));
    } catch (error) {
      handleApiError(error, t('Impossible de changer de site.'));
    }
  };

  useEffect(() => {
    const previousTitle = document.title;
    document.title = siteInfo.brand;
    return () => {
      document.title = previousTitle;
    };
  }, [siteInfo.brand]);

  const loadDiscovery = useCallback(async (authToken) => {
    setDiscoveryLoading(true);

    try {
      const response = await api.getDiscovery(authToken, {
        activeMode,
        query: searchQuery,
        city: cityQuery,
        ageMin: ageRange.min,
        ageMax: ageRange.max,
        detail: detailQuery,
        tonight: tonightOnly,
      });
      setProfiles(response.profiles);
      setPageError('');
    } catch (error) {
      handleApiError(error, t('Impossible de charger la découverte.'));
    } finally {
      setDiscoveryLoading(false);
    }
  }, [activeMode, cityQuery, handleApiError, searchQuery, ageRange, detailQuery, tonightOnly]);

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
          ageMin: ageRange.min,
          ageMax: ageRange.max,
          detail: detailQuery,
          tonight: tonightOnly,
        }).catch((error) => {
          if (error instanceof ApiError && error.details?.code === 'email_not_verified') {
            return { profiles: [] };
          }
          throw error;
        }),
      ]);

      if (bootstrapData.profile.mode !== site) {
        setToken('');
        setCurrentUser(null);
        return;
      }

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
  }, [activeMode, cityQuery, handleApiError, searchQuery, ageRange, detailQuery, tonightOnly]);

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
  }, [activeMode, cityQuery, currentUser, loadDiscovery, searchQuery, token, ageRange, detailQuery, tonightOnly]);

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
      setAds(data.ads || null);
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
    if (profileDraft.avatar && !/^(https?:\/\/|\/uploads\/)/i.test(profileDraft.avatar.trim())) {
      errors.avatar = t('Utilisez une URL commençant par http:// ou https://.');
    }

    return errors;
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthSubmitting(true);

    try {
      const response = authMode === 'register'
        ? await api.register({ ...authForm, mode: site, lang })
        : await api.login({ email: authForm.email, password: authForm.password, site });

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

  const handlePhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setProfileErrors((current) => ({ ...current, avatar: t('Choisissez une image JPEG, PNG ou WebP de 3 Mo maximum.') }));
      return;
    }

    setPhotoUploading(true);
    try {
      const { url } = await api.uploadPhoto(token, file);
      updateProfileField('avatar', url);
      setProfileErrors((current) => ({ ...current, avatar: undefined }));
    } catch (error) {
      setProfileErrors((current) => ({ ...current, avatar: error.message || t('Impossible d’envoyer la photo.') }));
    } finally {
      setPhotoUploading(false);
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

  const resetFilters = () => {
    setSearchQuery('');
    setCityQuery('');
    setAgeRange({ min: '', max: '' });
    setDetailQuery('');
    setTonightOnly(false);
  };

  const handleLike = async (profileId, options = {}) => {
    try {
      const response = await api.likeProfile(token, profileId, options);
      setHookFor(null);
      setHookText('');
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

  const updateDetails = (details) => {
    setProfileDraft((current) => ({ ...current, details }));
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
      <div className="app-shell" data-site={site}>
        <ToastRegion toasts={toasts} onDismiss={(toastId) => setToasts((current) => current.filter((item) => item.id !== toastId))} />
        <main className="page-shell">
          <section className="hero-panel auth-hero">
            <div className="hero-copy">
              <p className="eyebrow">{siteInfo.icon} {siteInfo.brand}</p>
              <h1>{t(content.headline)}</h1>
              <p>{t(content.intro)}</p>
              <ul className="category-list">
                {content.highlights.map((item) => <li key={item}>{t(item)}</li>)}
              </ul>
              <p>
                <a href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>{t('Découvrir les autres sites Lifys')}</a>
              </p>
            </div>

            <div className="content-panel auth-card">
              <SectionHeader
                eyebrow={authMode === 'register' ? t('Créer un compte') : t('Connexion')}
                title={authMode === 'register' ? t('Rejoindre {mode}', { mode: siteInfo.brand }) : t('Reprendre votre session')}
                description={t('Un seul compte Lifys pour les 5 sites : si vous en avez déjà un, connectez-vous avec le même e-mail et le même mot de passe.')}
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
        <><ConsentBanner ads={ads} hidden={isPremium} /><SiteFooter ads={ads} /></>
      </div>
    );
  }

  return (
    <div className="app-shell" data-site={site}>
      <ToastRegion toasts={toasts} onDismiss={(toastId) => setToasts((current) => current.filter((item) => item.id !== toastId))} />

      <header className="topbar">
        <button type="button" className="brand-block" onClick={() => setCurrentView('home')}>
          <span className="brand-icon">{siteInfo.icon}</span>
          <span>
            <strong>{siteInfo.brand}</strong>
            <small>{t(siteInfo.tagline)}</small>
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
              {t(siteInfo.nav[item.id] ?? item.label)}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <LanguageSwitcher />
          <select className="site-switcher" aria-label={t('Changer de site')} value={site} onChange={(event) => handleSiteChange(event.target.value)}>
            {Object.entries(SITES).map(([id, item]) => <option key={id} value={id}>{item.icon} {item.brand}</option>)}
          </select>
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
                    <span>{t(siteInfo.nav.matches ?? 'Matchs')}</span>
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
                  <span className="mini-label">{siteInfo.brand}</span>
                  <strong>{t(siteInfo.tagline)}</strong>
                  <p><a href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>{t('Découvrir les autres sites Lifys')}</a></p>
                </div>
              </div>
            </section>

            {!isPremium ? <AdSlot ads={ads} onUpgrade={() => setCurrentView('pricing')} /> : null}

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

            {!isPremium ? <AdSlot ads={ads} onUpgrade={() => setCurrentView('pricing')} /> : null}

            <div className="discover-toolbar">
              <div className="prefill-row" aria-label={t('Pré-remplissage')}>
                {profile.city ? (
                  <button type="button" className={cityQuery === profile.city ? 'pill active' : 'pill'} onClick={() => setCityQuery(cityQuery === profile.city ? '' : profile.city)}>
                    📍 {t('Ma ville : {city}', { city: profile.city })}
                  </button>
                ) : null}
                {(profile.interests ?? []).slice(0, 6).map((interest) => (
                  <button type="button" key={interest} className={searchQuery === interest ? 'pill active' : 'pill'} onClick={() => setSearchQuery(searchQuery === interest ? '' : interest)}>
                    # {interest}
                  </button>
                ))}
                {profile.age ? (
                  <button
                    type="button"
                    className={ageRange.min ? 'pill active' : 'pill'}
                    onClick={() => setAgeRange(ageRange.min ? { min: '', max: '' } : { min: String(Math.max(18, profile.age - 6)), max: String(profile.age + 6) })}
                  >
                    🎂 {t('Âge proche : {min}–{max}', { min: Math.max(18, profile.age - 6), max: profile.age + 6 })}
                  </button>
                ) : null}
                {site === 'professionnel' && profile.details?.sector ? (
                  <button type="button" className={detailQuery === profile.details.sector ? 'pill active' : 'pill'} onClick={() => setDetailQuery(detailQuery === profile.details.sector ? '' : profile.details.sector)}>
                    💼 {t('Mon secteur : {sector}', { sector: profile.details.sector })}
                  </button>
                ) : null}
                {searchQuery || cityQuery || ageRange.min || ageRange.max || detailQuery || tonightOnly ? (
                  <button type="button" className="link-button" onClick={resetFilters}>{t('Effacer les filtres')}</button>
                ) : null}
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
                <label>
                  <span>{t('Âge min')}</span>
                  <input type="number" min="18" max="99" value={ageRange.min} onChange={(event) => setAgeRange((current) => ({ ...current, min: event.target.value }))} />
                </label>
                <label>
                  <span>{t('Âge max')}</span>
                  <input type="number" min="18" max="99" value={ageRange.max} onChange={(event) => setAgeRange((current) => ({ ...current, max: event.target.value }))} />
                </label>
                <label>
                  <span>{site === 'professionnel' ? t('Métier, secteur ou compétence') : t('Détails (valeurs, activités…)')}</span>
                  <input type="search" value={detailQuery} onChange={(event) => setDetailQuery(event.target.value)} />
                </label>
                {site === 'sans-lendemain' ? (
                  <label className="checkbox-row">
                    <input type="checkbox" checked={tonightOnly} onChange={(event) => setTonightOnly(event.target.checked)} />
                    <span>🌙 {t('Disponibles ce soir')}</span>
                  </label>
                ) : null}
              </div>
            </div>

            {discoveryLoading ? (
              <EmptyState title={t('Chargement des profils')} description={t('Nous préparons vos recommandations.')} />
            ) : profiles.length === 0 ? (
              <EmptyState
                title={t('Aucun profil disponible')}
                description={t('Essayez une autre catégorie, élargissez vos filtres ou réinitialisez vos interactions.')}
                actionLabel={t('Effacer les filtres')}
                onAction={resetFilters}
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
                      {person.compatibility ? (
                        <p className="compat-line" title={person.compatibility.reasons.map((reason) => t(reason)).join(' · ')}>
                          💞 {t('{score} % compatible', { score: person.compatibility.score })}
                          {person.compatibility.reasons.length ? <small> — {person.compatibility.reasons.map((reason) => t(reason)).join(', ')}</small> : null}
                        </p>
                      ) : null}
                      <DetailChips person={person} t={t} />
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
                      {site === 'amoureux' ? (
                        <button type="button" className="like-button super-like" onClick={() => handleLike(person.id, { superLike: true })}>⭐ {t('Super like')}</button>
                      ) : null}
                      {site === 'professionnel' ? (
                        <button type="button" className="like-button" onClick={() => setHookFor(hookFor === person.id ? null : person.id)}>✉ {t('Message d’accroche')}</button>
                      ) : null}
                    </div>
                    {hookFor === person.id ? (
                      <form className="hook-form" onSubmit={(event) => { event.preventDefault(); handleLike(person.id, { note: hookText }); }}>
                        <textarea rows="2" maxLength="280" value={hookText} onChange={(event) => setHookText(event.target.value)} placeholder={t('Présentez-vous en une phrase…')} />
                        <button type="submit" className="primary-button" disabled={!hookText.trim()}>{t('Envoyer et se connecter')}</button>
                      </form>
                    ) : null}
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
              eyebrow={t(siteInfo.nav.matches ?? 'Matchs')}
              title={t('Vos correspondances')}
              description={t('Retrouvez ici toutes les personnes avec qui vous avez matché.')}
            />

            {dashboardLoading ? (
              <EmptyState title={t('Chargement des matchs')} description={t('Chargement de vos correspondances.')} />
            ) : matches.length === 0 ? (
              <EmptyState title={t('Aucun match pour l’instant')} description={t('Commencez par liker des profils pour créer vos premières connexions.')} actionLabel={t('Voir la découverte')} onAction={() => setCurrentView('discover')} />
            ) : (
              <div className="matches-list">
                {!isPremium ? <AdSlot ads={ads} onUpgrade={() => setCurrentView('pricing')} /> : null}
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
                </div>

                <label>
                  <span>{t('Photo')}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelected} disabled={photoUploading} />
                  <small>{photoUploading ? t('Envoi en cours…') : t('JPEG, PNG ou WebP, 3 Mo maximum.')}</small>
                  {profileDraft.avatar ? (
                    <button type="button" className="link-button" onClick={() => updateProfileField('avatar', '')}>{t('Retirer la photo')}</button>
                  ) : null}
                  {profileErrors.avatar ? <small className="field-error">{profileErrors.avatar}</small> : null}
                </label>

                <label>
                  <span>{t('Photo (URL)')}</span>
                  <input value={profileDraft.avatar} onChange={(event) => updateProfileField('avatar', event.target.value)} aria-invalid={Boolean(profileErrors.avatar)} />
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

                <SiteFieldsForm site={site} details={profileDraft.details ?? {}} onChange={updateDetails} t={t} />

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

      <><ConsentBanner ads={ads} hidden={isPremium} /><SiteFooter ads={ads} /></>
    </div>
  );
}

export default App;

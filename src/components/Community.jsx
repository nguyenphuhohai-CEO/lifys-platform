import { useCallback, useEffect, useState } from 'react';

import Avatar from './Avatar';
import { PhotoStrip } from './Gallery';
import { DetailChips } from './SiteFields';
import { api } from '../lib/api';

const formatDate = (iso, locale) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

function Header({ eyebrow, title, description }) {
  return (
    <div className="panel-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
    </div>
  );
}

const REPORT_REASONS = [
  ['spam', 'Spam ou publicité'],
  ['harcelement', 'Harcèlement'],
  ['faux-profil', 'Faux profil ou arnaque'],
  ['contenu-inapproprie', 'Contenu inapproprié'],
  ['autre', 'Autre'],
];

export function ReportInline({ token, target, t, onError, showToast }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');

  const send = async () => {
    try {
      await api.reportContent(token, { ...target, reason });
      showToast({ type: 'success', title: t('Signalement envoyé'), message: t('Merci, notre équipe va examiner ce contenu.') });
      setOpen(false);
    } catch (error) {
      onError(error, t('Signalement impossible.'));
    }
  };

  if (!open) {
    return <button type="button" className="link-button" onClick={() => setOpen(true)}>{t('Signaler')}</button>;
  }

  return (
    <span className="report-inline">
      <select value={reason} onChange={(event) => setReason(event.target.value)} aria-label={t('Motif')}>
        {REPORT_REASONS.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}
      </select>
      <button type="button" className="link-button" onClick={send}>{t('Envoyer')}</button>
      <button type="button" className="link-button" onClick={() => setOpen(false)}>{t('Annuler')}</button>
    </span>
  );
}

function useLoader(load, onError, fallback) {
  const [data, setData] = useState(null);
  const refresh = useCallback(async () => {
    try {
      setData(await load());
    } catch (error) {
      onError(error, fallback);
    }
  }, [load, onError, fallback]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return [data, refresh];
}

export function EventsPanel({ token, t, locale, defaultCity, onError, showToast }) {
  const load = useCallback(() => api.getEvents(token), [token]);
  const [data, refresh] = useLoader(load, onError, t('Impossible de charger les sorties.'));
  const [form, setForm] = useState({ title: '', place: '', city: defaultCity ?? '', startsAt: '', capacity: 6, description: '' });
  const [saving, setSaving] = useState(false);
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const act = async (action, successMessage) => {
    try {
      await action();
      if (successMessage) showToast({ type: 'success', title: successMessage, message: '' });
      await refresh();
    } catch (error) {
      onError(error, t('Action impossible.'));
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    await act(() => api.createEvent(token, { ...form, startsAt: new Date(form.startsAt).toISOString() }), t('Sortie créée'));
    setForm((current) => ({ ...current, title: '', place: '', description: '', startsAt: '' }));
    setSaving(false);
  };

  return (
    <section className="content-panel">
      <Header eyebrow={t('Sorties')} title={t('Sorties entre amis')} description={t('Organisez ou rejoignez une sortie de groupe près de chez vous : café, randonnée, jeux de société…')} />

      <form className="profile-form community-form" onSubmit={submit}>
        <label><span>{t('Titre')}</span><input required minLength="3" maxLength="80" value={form.title} onChange={(event) => set('title', event.target.value)} /></label>
        <label><span>{t('Lieu')}</span><input maxLength="80" value={form.place} onChange={(event) => set('place', event.target.value)} /></label>
        <label><span>{t('Ville')}</span><input maxLength="60" value={form.city} onChange={(event) => set('city', event.target.value)} /></label>
        <label><span>{t('Date et heure')}</span><input required type="datetime-local" value={form.startsAt} onChange={(event) => set('startsAt', event.target.value)} /></label>
        <label><span>{t('Places')}</span><input type="number" min="2" max="50" value={form.capacity} onChange={(event) => set('capacity', event.target.value)} /></label>
        <label><span>{t('Description')}</span><textarea rows="2" maxLength="500" value={form.description} onChange={(event) => set('description', event.target.value)} /></label>
        <div className="form-actions"><button type="submit" className="primary-button" disabled={saving}>{t('Proposer la sortie')}</button></div>
      </form>

      {!data ? null : data.events.length === 0 ? (
        <div className="empty-state"><h3>{t('Aucune sortie prévue')}</h3><p>{t('Soyez le premier à proposer une sortie.')}</p></div>
      ) : (
        <div className="discover-grid">
          {data.events.map((item) => (
            <article key={item.id} className="profile-card event-card">
              <div className="profile-card-body">
                <h3>{item.title}</h3>
                <p className="city-line">🗓 {formatDate(item.startsAt, locale)}</p>
                <p className="city-line">📍 {[item.place, item.city].filter(Boolean).join(', ') || t('Lieu à préciser')}</p>
                {item.description ? <p>{item.description}</p> : null}
                <p className="muted small">{t('Organisé par {name}', { name: item.hostName })} · {t('{count}/{max} participants', { count: item.attendees, max: item.capacity })}</p>
              </div>
              <div className="card-actions">
                {item.joined ? (
                  <button type="button" className="pass-button" onClick={() => act(() => api.leaveEvent(token, item.id))}>{item.isHost ? t('Annuler la sortie') : t('Se désinscrire')}</button>
                ) : (
                  <button type="button" className="like-button" disabled={item.attendees >= item.capacity} onClick={() => act(() => api.joinEvent(token, item.id), t('Inscription confirmée'))}>
                    {item.attendees >= item.capacity ? t('Complet') : t('Je participe')}
                  </button>
                )}
                {!item.isHost ? <ReportInline token={token} target={{ eventId: item.id }} t={t} onError={onError} showToast={showToast} /> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

const POST_KINDS = [['post', 'Publication'], ['offre', 'Offre d’emploi'], ['recherche', 'Recherche de mission']];

export function FeedPanel({ token, t, locale, onError, showToast }) {
  const load = useCallback(() => api.getPosts(token), [token]);
  const [data, refresh] = useLoader(load, onError, t('Impossible de charger le fil.'));
  const [content, setContent] = useState('');
  const [kind, setKind] = useState('post');

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.createPost(token, { content, kind });
      setContent('');
      showToast({ type: 'success', title: t('Publication ajoutée'), message: '' });
      await refresh();
    } catch (error) {
      onError(error, t('Publication impossible.'));
    }
  };

  const remove = async (id) => {
    try {
      await api.deletePost(token, id);
      await refresh();
    } catch (error) {
      onError(error, t('Suppression impossible.'));
    }
  };

  return (
    <section className="content-panel">
      <Header eyebrow={t('Fil d’actualité')} title={t('Le fil des professionnels')} description={t('Partagez une actualité, une offre ou une recherche de mission avec votre réseau.')} />

      <form className="profile-form" onSubmit={submit}>
        <label>
          <span>{t('Type')}</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            {POST_KINDS.map(([id, label]) => <option key={id} value={id}>{t(label)}</option>)}
          </select>
        </label>
        <label><span>{t('Votre message')}</span><textarea required rows="3" minLength="3" maxLength="1000" value={content} onChange={(event) => setContent(event.target.value)} /></label>
        <div className="form-actions"><button type="submit" className="primary-button" disabled={content.trim().length < 3}>{t('Publier')}</button></div>
      </form>

      {!data ? null : data.posts.length === 0 ? (
        <div className="empty-state"><h3>{t('Aucune publication')}</h3><p>{t('Lancez la conversation avec votre réseau.')}</p></div>
      ) : (
        <div className="feed-list">
          {data.posts.map((post) => (
            <article key={post.id} className="feed-post">
              <div className="feed-author">
                <Avatar className="feed-avatar" src={post.authorAvatar} alt={post.authorName} fallback={post.authorName} />
                <div>
                  <strong>{post.authorName}</strong>
                  {post.authorJob ? <small>{post.authorJob}</small> : null}
                </div>
                <span className="tag">{t(POST_KINDS.find(([id]) => id === post.kind)?.[1] ?? 'Publication')}</span>
              </div>
              <p>{post.content}</p>
              <small className="muted">{formatDate(post.createdAt, locale)}</small>
              {post.mine
                ? <button type="button" className="link-button" onClick={() => remove(post.id)}>{t('Supprimer')}</button>
                : <ReportInline token={token} target={{ postId: post.id }} t={t} onError={onError} showToast={showToast} />}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function LikesPanel({ token, t, onError, onUpgrade, onDiscover }) {
  const load = useCallback(() => api.getLikesReceived(token), [token]);
  const [data] = useLoader(load, onError, t('Impossible de charger les likes reçus.'));

  return (
    <section className="content-panel">
      <Header eyebrow={t('Likes reçus')} title={t('Ils vous ont remarqué')} description={t('Les personnes qui vous ont liké et que vous n’avez pas encore vues.')} />
      {!data ? null : data.count === 0 ? (
        <div className="empty-state"><h3>{t('Pas encore de like')}</h3><p>{t('Complétez votre profil pour être mieux repéré.')}</p><button type="button" className="secondary-button" onClick={onDiscover}>{t('Voir la découverte')}</button></div>
      ) : data.locked ? (
        <div className="empty-state">
          <h3>{t('{count} personne(s) vous ont liké', { count: data.count })}</h3>
          <p>{t('Passez à Lifys Premium pour voir qui vous a liké.')}</p>
          <button type="button" className="primary-button" onClick={onUpgrade}>{t('Découvrir Premium')}</button>
        </div>
      ) : (
        <div className="discover-grid">
          {data.profiles.map((person) => (
            <article key={person.id} className="profile-card">
              <Avatar className="profile-avatar" src={person.avatar} alt={person.name} fallback={person.name} />
              <div className="profile-card-body">
                <h3>{person.name}, {person.age ?? '18+'}</h3>
                <p className="city-line">📍 {person.city}</p>
                <p>{person.bio}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PersonCards({ people, token, t, onError, showToast, onLiked }) {
  const like = async (person) => {
    try {
      await api.likeProfile(token, person.id);
      showToast({ type: 'success', title: t('Like envoyé'), message: person.name });
      onLiked();
    } catch (error) {
      onError(error, t('Impossible d’envoyer le like.'));
    }
  };

  return (
    <div className="discover-grid">
      {people.map((person) => (
        <article key={person.id} className="profile-card">
          <Avatar className="profile-avatar" src={person.avatar} alt={person.name} fallback={person.name} />
          <PhotoStrip photos={person.photos} />
          <div className="profile-card-body">
            <h3>{person.name}, {person.age ?? '18+'}</h3>
            <p className="city-line">📍 {person.city}</p>
            {person.compatibility ? (
              <p className="compat-line">
                💞 {t('{score} % compatible', { score: person.compatibility.score })}
                {person.compatibility.reasons.length ? <small> — {person.compatibility.reasons.map((reason) => t(reason)).join(', ')}</small> : null}
              </p>
            ) : null}
            <DetailChips person={person} t={t} />
            <p>{person.bio}</p>
          </div>
          <div className="card-actions">
            <button type="button" className="like-button" onClick={() => like(person)}>{t('Liker')}</button>
          </div>
        </article>
      ))}
    </div>
  );
}

const TONIGHT_TIPS = [
  'Donnez rendez-vous dans un lieu public et fréquenté.',
  'Prévenez un proche de l’heure et du lieu.',
  'Le consentement est indispensable : un non est un non.',
  'Signalez immédiatement tout comportement inapproprié.',
];

function SafetyAlert({ token, t, onError, showToast }) {
  const [contactEmail, setContactEmail] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    try {
      await api.sendSafetyAlert(token, { contactEmail, details });
      showToast({ type: 'success', title: t('Proche prévenu'), message: t('Votre proche a reçu un e-mail avec les détails.') });
      setDetails('');
    } catch (error) {
      onError(error, t('Action impossible.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="safety-alert" onSubmit={submit}>
      <h3>🛡️ {t('Prévenir un proche')}</h3>
      <p className="muted small">{t('Avant un rendez-vous, envoyez à un proche l’heure et le lieu. Nous ne conservons ni son adresse ni le message.')}</p>
      <input type="email" required maxLength="254" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder={t('E-mail de votre proche')} />
      <textarea maxLength="300" value={details} onChange={(event) => setDetails(event.target.value)} placeholder={t('Lieu, heure, prénom de la personne rencontrée…')} />
      <button type="submit" className="primary-button" disabled={sending}>{sending ? t('Chargement…') : t('Envoyer l’alerte')}</button>
    </form>
  );
}

export function TonightPanel({ token, t, locale, profile, onProfile, onError, showToast }) {
  const load = useCallback(() => api.getDiscovery(token, { activeMode: 'all', tonight: true }), [token]);
  const [data, refresh] = useLoader(load, onError, t('Impossible de charger les profils.'));
  const active = Boolean(profile.tonightUntil);

  const toggle = async () => {
    try {
      const { profile: updated } = await api.setTonight(token, !active);
      onProfile(updated);
      await refresh();
    } catch (error) {
      onError(error, t('Action impossible.'));
    }
  };

  return (
    <section className="content-panel">
      <Header eyebrow={t('Ce soir')} title={t('Disponibles ce soir')} description={t('Activez le mode « Ce soir » pour apparaître en tête pendant 12 h. Il se désactive tout seul.')} />
      <div className="tonight-toggle">
        <button type="button" className={active ? 'secondary-button' : 'primary-button'} onClick={toggle}>
          {active ? t('Désactiver le mode Ce soir') : t('Activer le mode Ce soir')}
        </button>
        {active ? <span className="badge badge-tonight">🌙 {t('Actif jusqu’à {time}', { time: new Date(profile.tonightUntil).toLocaleTimeString(locale, { timeStyle: 'short' }) })}</span> : null}
      </div>
      <ul className="safety-tips">
        {TONIGHT_TIPS.map((tip) => <li key={tip}>{t(tip)}</li>)}
      </ul>
      <SafetyAlert token={token} t={t} onError={onError} showToast={showToast} />
      {!data ? null : data.profiles.length === 0 ? (
        <div className="empty-state"><h3>{t('Personne pour l’instant')}</h3><p>{t('Revenez plus tard : les profils « Ce soir » apparaissent ici.')}</p></div>
      ) : (
        <PersonCards people={data.profiles} token={token} t={t} onError={onError} showToast={showToast} onLiked={refresh} />
      )}
    </section>
  );
}

export function SelectionPanel({ token, t, onError, showToast }) {
  const [minScore, setMinScore] = useState(60);
  const load = useCallback(() => api.getDiscovery(token, { activeMode: 'all', minScore }), [token, minScore]);
  const [data, refresh] = useLoader(load, onError, t('Impossible de charger les profils.'));

  return (
    <section className="content-panel">
      <Header eyebrow={t('Sélection')} title={t('Votre sélection compatible')} description={t('Les profils les plus proches de vos valeurs, de votre projet de famille et de votre région.')} />
      <label className="score-filter">
        <span>{t('Compatibilité minimale')}</span>
        <select value={minScore} onChange={(event) => setMinScore(Number(event.target.value))}>
          {[40, 60, 80].map((value) => <option key={value} value={value}>{value} %</option>)}
        </select>
      </label>
      {!data ? null : data.profiles.length === 0 ? (
        <div className="empty-state"><h3>{t('Aucun profil à ce niveau')}</h3><p>{t('Baissez le seuil ou complétez votre profil (valeurs, projet d’enfants, région).')}</p></div>
      ) : (
        <PersonCards people={data.profiles} token={token} t={t} onError={onError} showToast={showToast} onLiked={refresh} />
      )}
    </section>
  );
}

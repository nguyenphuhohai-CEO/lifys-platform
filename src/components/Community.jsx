import { useCallback, useEffect, useState } from 'react';

import Avatar from './Avatar';
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
              {post.mine ? <button type="button" className="link-button" onClick={() => remove(post.id)}>{t('Supprimer')}</button> : null}
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

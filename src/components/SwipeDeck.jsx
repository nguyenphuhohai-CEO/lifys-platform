import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import { PhotoStrip } from './Gallery';
import { DetailChips } from './SiteFields';
import { getModeById } from '../utils/app-utils';

const THRESHOLD = 110;

// Paquet de cartes : glisser à droite = like, à gauche = passer. Flèches du clavier et boutons disponibles.
export default function SwipeDeck({ profiles, t, canSuperLike, onLike, onPass, onSuperLike }) {
  const person = profiles[0];
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(0);
  const start = useRef(null);

  const decide = (direction, superLike = false) => {
    if (!person || leaving) return;
    setLeaving(direction);
    setTimeout(() => {
      setLeaving(0);
      setDx(0);
      if (superLike) onSuperLike(person.id);
      else if (direction > 0) onLike(person.id);
      else onPass(person.id);
    }, 220);
  };

  useEffect(() => {
    const onKey = (event) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      if (event.key === 'ArrowRight') decide(1);
      if (event.key === 'ArrowLeft') decide(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!person) return null;

  const offset = leaving ? leaving * 600 : dx;
  const style = { transform: `translateX(${offset}px) rotate(${offset / 25}deg)`, transition: start.current ? 'none' : 'transform 220ms ease' };

  return (
    <div className="swipe-deck">
      <p className="swipe-count">{t('{count} profils', { count: profiles.length })}</p>
      <article
        className="swipe-card"
        style={style}
        onPointerDown={(event) => { start.current = event.clientX; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (start.current !== null) setDx(event.clientX - start.current); }}
        onPointerUp={() => {
          const moved = dx;
          start.current = null;
          if (moved > THRESHOLD) decide(1);
          else if (moved < -THRESHOLD) decide(-1);
          else setDx(0);
        }}
        onPointerCancel={() => { start.current = null; setDx(0); }}
      >
        {dx > 40 ? <span className="swipe-stamp like">{t('Like')}</span> : null}
        {dx < -40 ? <span className="swipe-stamp pass">{t('Passer')}</span> : null}
        <Avatar className="profile-avatar" src={person.avatar} alt={person.name} fallback={person.name} />
        <PhotoStrip photos={person.photos} />
        <div className="profile-card-body">
          <h3>{person.name}, {person.age ?? '18+'}</h3>
          <p className="city-line">📍 {person.city || t('Ville non précisée')} · {t(getModeById(person.mode).label)}</p>
          {person.compatibility ? <p className="compat-line">💞 {t('{score} % compatible', { score: person.compatibility.score })}</p> : null}
          <DetailChips person={person} t={t} />
          <p>{person.bio || t('Profil en cours de complétion.')}</p>
        </div>
      </article>
      <div className="swipe-actions">
        <button type="button" className="pass-button" aria-label={t('Passer')} onClick={() => decide(-1)}>✕</button>
        {canSuperLike ? <button type="button" className="like-button super-like" aria-label={t('Super like')} onClick={() => decide(1, true)}>⭐</button> : null}
        <button type="button" className="like-button" aria-label={t('Like')} onClick={() => decide(1)}>♥</button>
      </div>
      <small className="swipe-hint">{t('Glissez la carte ou utilisez les flèches ← →')}</small>
    </div>
  );
}

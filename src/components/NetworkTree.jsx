import { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';
import { FamilyTree } from './Community';

const SITE_LABELS = { amical: 'Amis', amoureux: 'Love', 'sans-lendemain': 'Éphémère', mariage: 'Mariage', professionnel: 'Pro' };

function FriendNode({ person, token, t, onError, seen, depth }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState(null);
  const toggle = async () => {
    if (!open && children === null) {
      try {
        const result = await api.getFriendsOf(token, person.id);
        setChildren(result.friends.filter((friend) => !seen.has(friend.id)));
      } catch (error) {
        onError(error, t('Impossible de charger l’arbre.'));
        return;
      }
    }
    setOpen(!open);
  };
  const nextSeen = new Set(seen).add(person.id);
  const label = depth === 1 ? t('Ami') : depth === 2 ? t('Ami d’ami') : t('Ami d’ami d’ami') + (depth > 3 ? ' ×' + (depth - 2) : '');

  return (
    <li className="ftree-item">
      <button type="button" className="ftree-node" onClick={toggle} aria-expanded={open}>
        <span className="ftree-caret">{open ? '▾' : '▸'}</span>
        <strong>{person.name}</strong>
        <span className="muted"> · {label}{person.site ? ' · ' + t(SITE_LABELS[person.site] ?? person.site) : ''}</span>
      </button>
      {open ? (
        children?.length ? (
          <ul className="ftree-list">
            {children.map((child) => <FriendNode key={child.id} person={child} token={token} t={t} onError={onError} seen={nextSeen} depth={depth + 1} />)}
          </ul>
        ) : <p className="muted ftree-empty">{t('Aucun autre ami à afficher.')}</p>
      ) : null}
    </li>
  );
}

export default function NetworkTree({ token, t, onError }) {
  const [data, setData] = useState(null);
  const load = useCallback(() => api.getNetwork(token).then(setData).catch((error) => onError(error, t('Impossible de charger l’arbre.'))), [token, onError, t]);
  useEffect(() => { load(); }, [load]);

  const friends = data?.friends ?? [];
  const seen = new Set(friends.map((friend) => friend.id));

  return (
    <section className="content-panel">
      <header className="panel-header">
        <p className="eyebrow">{t('Mon arbre')}</p>
        <h2>{t('Mon arbre : famille et amis')}</h2>
        <p className="muted">{t('Dépliez chaque ami pour voir ses propres amis, et ainsi de suite.')}</p>
      </header>
      <div className="family-tree">
        <p className="ftree-root">⭐ <strong>{t('Vous')}</strong></p>
        <ul className="ftree-list">
          {friends.map((friend) => <FriendNode key={friend.id} person={friend} token={token} t={t} onError={onError} seen={seen} depth={1} />)}
        </ul>
        {data && !friends.length ? <p className="muted">{t('Faites des matchs : vos amis apparaîtront ici.')}</p> : null}
      </div>
      <FamilyTree token={token} t={t} onError={onError} />
    </section>
  );
}

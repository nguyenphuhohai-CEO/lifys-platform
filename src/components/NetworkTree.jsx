import { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';
import { FamilyTree } from './Community';

const SITE_LABELS = { amical: 'Amis', amoureux: 'Love', 'sans-lendemain': 'Éphémère', mariage: 'Mariage', professionnel: 'Pro' };

function Branch({ title, people, render }) {
  if (!people.length) {
    return null;
  }
  return (
    <div className="tree-row">
      <span className="tree-label">{title}</span>
      <div className="tree-people">{people.map((person) => <span key={person.id} className="tree-node">{render(person)}</span>)}</div>
    </div>
  );
}

export default function NetworkTree({ token, t, onError }) {
  const [data, setData] = useState(null);
  const load = useCallback(() => api.getNetwork(token).then(setData).catch((error) => onError(error, t('Impossible de charger l’arbre.'))), [token, onError, t]);
  useEffect(() => { load(); }, [load]);

  const friends = data?.friends ?? [];
  const second = (data?.friendsOfFriends ?? []).filter((person) => person.degree === 2);
  const third = (data?.friendsOfFriends ?? []).filter((person) => person.degree === 3);

  return (
    <section className="content-panel">
      <header className="panel-header">
        <p className="eyebrow">{t('Mon arbre')}</p>
        <h2>{t('Mon arbre : famille et amis')}</h2>
        <p className="muted">{t('Votre famille et vos amis sur l’ensemble de Lifys, jusqu’au troisième degré.')}</p>
      </header>
      <div className="family-tree">
        <div className="tree-rows">
          <Branch title={t('Amis d’amis d’amis')} people={third} render={(p) => p.name} />
          <Branch title={t('Amis d’amis')} people={second} render={(p) => p.name + (p.via?.length ? ' · ' + p.via.join(', ') : '')} />
          <Branch title={t('Amis')} people={friends} render={(p) => p.name + ' · ' + t(SITE_LABELS[p.site] ?? p.site)} />
          <div className="tree-row tree-me"><span className="tree-label">{t('Vous')}</span><div className="tree-people"><span className="tree-node tree-self">⭐ {t('Vous')}</span></div></div>
        </div>
        {data && !friends.length ? <p className="muted">{t('Faites des matchs : vos amis apparaîtront ici.')}</p> : null}
      </div>
      <FamilyTree token={token} t={t} onError={onError} />
    </section>
  );
}

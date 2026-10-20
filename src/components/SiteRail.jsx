import { useEffect, useState } from 'react';
import { SITES } from '../data/sites';
import { api } from '../lib/api';
import { useI18n } from '../i18n';

// Barre des 5 sites du compte : chacun garde sa couleur, son état et ses notifications.
export default function SiteRail({ token, site, refreshKey, onSwitch }) {
  const { t } = useI18n();
  const [overview, setOverview] = useState({});

  useEffect(() => {
    let cancelled = false;
    api.getHub(token).then((response) => {
      if (!cancelled) setOverview(response.sites ?? {});
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, refreshKey]);

  return (
    <nav className="site-rail" aria-label={t('Mes sites Lifys')}>
      {Object.entries(SITES).map(([id, info]) => {
        const state = overview[id];
        const waiting = state?.awaitingReply ?? 0;
        const className = ['site-tab', id === site ? 'active' : '', state ? '' : 'not-joined'].filter(Boolean).join(' ');
        return (
          <button
            key={id}
            type="button"
            data-site={id}
            className={className}
            aria-current={id === site ? 'page' : undefined}
            onClick={() => onSwitch(id)}
          >
            <span className="site-tab-icon" aria-hidden="true">{info.icon}</span>
            <span className="site-tab-body">
              <strong>{info.brand}</strong>
              <small>
                {!state ? t('Rejoindre')
                  : !state.completed ? t('Profil à compléter')
                    : t('{count} match(s)', { count: state.matches })}
              </small>
            </span>
            {waiting > 0 ? <span className="site-tab-badge" title={t('Messages en attente de réponse')}>{waiting}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

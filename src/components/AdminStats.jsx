import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n';

export default function AdminStats({ token, onError }) {
  const { t } = useI18n();
  const [sites, setSites] = useState(null);

  useEffect(() => {
    api.getAdminStats(token)
      .then((response) => setSites(response.sites))
      .catch((error) => onError(error, t('Impossible de charger les statistiques.')));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="content-panel admin-stats">
      <p className="eyebrow">{t('Administration')}</p>
      <h2>{t('Statistiques')}</h2>
      {sites === null ? <p>{t('Chargement…')}</p> : (
        <table>
          <thead>
            <tr>
              <th>{t('Site')}</th><th>{t('Profils')}</th><th>{t('Nouveaux (7 j)')}</th><th>Premium</th><th>{t('Matchs')}</th><th>{t('Taux de match')}</th><th>{t('Taux de réponse')}</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((row) => (
              <tr key={row.site}>
                <td>{row.site}</td><td>{row.profiles}</td><td>{row.newThisWeek}</td><td>{row.premium}</td><td>{row.matches}</td><td>{row.matchRate} %</td><td>{row.replyRate} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

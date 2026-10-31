import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n';
import AdminSelfies from './AdminSelfies';
import AdminStats from './AdminStats';

const KIND_LABEL = { profile: 'Profil', post: 'Publication', event: 'Sortie' };

// File d'attente de modération, réservée aux adresses listées dans ADMIN_EMAILS.
export default function AdminPanel({ token, onError }) {
  const { t } = useI18n();
  const [reports, setReports] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const response = await api.getAdminReports(token);
      setReports(response.reports);
    } catch (error) {
      onError(error, t('Impossible de charger les signalements.'));
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (report, action) => {
    const confirmations = {
      suspend: t('Suspendre le compte de {name} sur tous les sites ?', { name: report.target.name }),
      remove: t('Supprimer définitivement ce contenu ?'),
    };
    if (confirmations[action] && !window.confirm(confirmations[action])) return;
    setBusyId(report.id);
    try {
      await api.resolveAdminReport(token, report.id, action);
      await load();
    } catch (error) {
      onError(error, t('Action impossible.'));
    } finally {
      setBusyId('');
    }
  };

  const kinds = ['all', 'profile', 'post', 'event'];
  const visible = (reports ?? []).filter((report) => filter === 'all' || (report.content.kind ?? 'profile') === filter);

  return (
    <>
    <AdminStats token={token} onError={onError} />
    <AdminSelfies token={token} onError={onError} />
    <section className="content-panel admin-panel">
      <div className="checklist-head">
        <div>
          <p className="eyebrow">{t('Administration')}</p>
          <h2>{t('Modération')}</h2>
        </div>
        <span className="counter-badge">{t('{count} signalement(s) ouvert(s)', { count: reports?.length ?? 0 })}</span>
      </div>

      <div className="prefill-row" role="group" aria-label={t('Filtrer par type')}>
        {kinds.map((kind) => (
          <button key={kind} type="button" className={filter === kind ? 'pill active' : 'pill'} onClick={() => setFilter(kind)}>
            {kind === 'all' ? t('Tout') : t(KIND_LABEL[kind])}
          </button>
        ))}
      </div>

      {reports === null ? <p>{t('Chargement…')}</p> : null}
      {reports && !visible.length ? <p className="empty-state">{t('Aucun signalement à traiter.')}</p> : null}

      <ul className="admin-list">
        {visible.map((report) => {
          const kind = report.content.kind ?? 'profile';
          return (
            <li key={report.id} className="admin-report">
              <div className="admin-report-head">
                <span className="tag">{t(KIND_LABEL[kind] ?? 'Profil')}</span>
                <strong>{report.target.name}</strong>
                <small>{report.target.email}</small>
                {report.target.status !== 'active' ? <span className="tag">{t('Suspendu')}</span> : null}
              </div>
              <p><strong>{t('Motif')} :</strong> {report.reason}{report.details ? ` — ${report.details}` : ''}</p>
              {report.content.excerpt ? <blockquote>{report.content.excerpt}</blockquote> : null}
              <small>{t('Signalé par {email} le {date}', { email: report.reporterEmail, date: new Date(report.createdAt).toLocaleString() })}</small>
              <div className="form-actions">
                <button type="button" className="secondary-button" disabled={busyId === report.id} onClick={() => resolve(report, 'dismiss')}>{t('Ignorer')}</button>
                {kind !== 'profile' ? (
                  <button type="button" className="secondary-button" disabled={busyId === report.id} onClick={() => resolve(report, 'remove')}>{t('Supprimer le contenu')}</button>
                ) : null}
                <button type="button" className="primary-button" disabled={busyId === report.id} onClick={() => resolve(report, 'suspend')}>{t('Suspendre l’auteur')}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
    </>
  );
}

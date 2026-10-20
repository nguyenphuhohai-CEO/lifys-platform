import { SITE_FIELDS } from '../data/siteFields';

export function SiteFieldsForm({ site, details, onChange, t }) {
  const fields = SITE_FIELDS[site] ?? [];
  if (!fields.length) return null;

  const set = (id, value) => onChange({ ...details, [id]: value });

  return (
    <fieldset className="site-fields">
      <legend>{t('Informations spécifiques')}</legend>
      <p className="muted small">{t('Tous ces champs sont facultatifs. Certaines informations (religion, tabac…) sont sensibles : ne renseignez que ce que vous souhaitez rendre visible.')}</p>
      <div className="site-fields-grid">
        {fields.map((field) => {
          const value = details?.[field.id];
          if (field.type === 'bool') {
            return (
              <label key={field.id} className="checkbox-row">
                <input type="checkbox" checked={Boolean(value)} onChange={(event) => set(field.id, event.target.checked)} />
                <span>{t(field.label)}</span>
              </label>
            );
          }
          return (
            <label key={field.id}>
              <span>{t(field.label)}</span>
              {field.type === 'select' ? (
                <select value={value ?? ''} onChange={(event) => set(field.id, event.target.value)}>
                  <option value="">—</option>
                  {field.options.map((option) => <option key={option} value={option}>{t(option)}</option>)}
                </select>
              ) : field.type === 'tags' ? (
                <input value={Array.isArray(value) ? value.join(', ') : value ?? ''} onChange={(event) => set(field.id, event.target.value)} placeholder={t('Séparés par des virgules')} />
              ) : field.type === 'number' ? (
                <input type="number" min="18" max="99" value={value ?? ''} onChange={(event) => set(field.id, event.target.value)} />
              ) : (
                <input type={field.type === 'url' ? 'url' : 'text'} maxLength="200" value={value ?? ''} onChange={(event) => set(field.id, event.target.value)} placeholder={field.type === 'url' ? 'https://www.linkedin.com/in/…' : ''} />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const CARD_FIELDS = {
  amoureux: ['situation', 'children', 'smoker', 'looking'],
  amical: ['availability', 'activities'],
  'sans-lendemain': ['expectations', 'discretion'],
  mariage: ['religion', 'childrenPlan', 'relocate', 'values'],
  professionnel: ['job', 'company', 'sector', 'goal', 'skills'],
};

export function DetailChips({ person, t }) {
  const details = person.details ?? {};
  const fields = SITE_FIELDS[person.mode] ?? [];
  const chips = (CARD_FIELDS[person.mode] ?? [])
    .map((id) => fields.find((field) => field.id === id))
    .filter((field) => field && details[field.id] !== undefined)
    .flatMap((field) => (Array.isArray(details[field.id]) ? details[field.id] : [details[field.id]]).map((item) => ({ key: `${field.id}-${item}`, text: field.type === 'select' ? t(item) : item })));

  return (
    <>
      <div className="badge-row">
        {person.verified ? <span className="badge badge-ok">✔ {t('Profil vérifié')}</span> : null}
        {details.tonight ? <span className="badge badge-tonight">🌙 {t('Ce soir')}</span> : null}
        {details.consent ? <span className="badge">🤝 {t('Consentement affiché')}</span> : null}
        {details.linkedin ? <a className="badge" href={details.linkedin} target="_blank" rel="noopener noreferrer nofollow">in LinkedIn</a> : null}
      </div>
      {chips.length ? (
        <div className="interest-row detail-row">
          {chips.map((chip) => <span key={chip.key}>{chip.text}</span>)}
        </div>
      ) : null}
    </>
  );
}

import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { demoProfiles } from './data/demoProfiles'
import {
  createInitialConversation,
  createMatch,
  defaultMode,
  filterProfiles,
  isCompatibleMatch,
  isProfileComplete,
  normalizeInterestInput,
  serializeInterestInput,
  validateProfile,
} from './lib/matching'
import { clearState, loadState, persistState } from './lib/storage'
import { MODES, type Match, type Message, type Profile, type View } from './types'

const modeLabels = {
  amical: 'Amical',
  amoureux: 'Amoureux',
  'sans lendemain': 'Sans lendemain',
  mariage: 'Mariage',
  professionnel: 'Professionnel',
} as const

const modeDescriptions = {
  amical: 'Rencontrer de nouvelles personnes pour partager des activités et créer du lien.',
  amoureux: 'Créer une relation sincère autour d’affinités et d’un rythme assumé.',
  'sans lendemain': 'Des rencontres spontanées, claires et respectueuses dans un cadre simple.',
  mariage: 'Trouver une personne alignée sur la durée, les valeurs et les projets communs.',
  professionnel: 'Développer un réseau humain pour collaborer, apprendre et entreprendre.',
} as const

const navItems: { id: View; label: string }[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'discover', label: 'Découvrir' },
  { id: 'matches', label: 'Matchs' },
  { id: 'messages', label: 'Messages' },
  { id: 'profile', label: 'Profil' },
]

const initialErrors = {} as Partial<Record<keyof Profile, string>>

const ProfileAvatar = ({ name, imageUrl, className }: { name: string; imageUrl: string; className: string }) =>
  imageUrl ? (
    <img src={imageUrl} alt="" className={className} />
  ) : (
    <div className={`${className} avatar-fallback`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </div>
  )

function App() {
  const persistedState = useMemo(() => loadState(), [])
  const [view, setView] = useState<View>('home')
  const [activeMode, setActiveMode] = useState(persistedState.activeMode)
  const [profile, setProfile] = useState<Profile>(persistedState.profile)
  const [likes, setLikes] = useState<string[]>(persistedState.likes)
  const [passes, setPasses] = useState<string[]>(persistedState.passes)
  const [matches, setMatches] = useState<Match[]>(persistedState.matches)
  const [messages, setMessages] = useState<Message[]>(persistedState.messages)
  const [profileErrors, setProfileErrors] = useState(initialErrors)
  const [cityFilter, setCityFilter] = useState('')
  const [interestFilter, setInterestFilter] = useState('')
  const [interestInput, setInterestInput] = useState(serializeInterestInput(persistedState.profile.interests))
  const [storageError, setStorageError] = useState<string | null>(persistedState.error ?? null)
  const [selectedMatchId, setSelectedMatchId] = useState<string>(persistedState.matches[0]?.id ?? '')
  const [draftMessage, setDraftMessage] = useState('')
  const [flashMessage, setFlashMessage] = useState('')

  useEffect(() => {
    persistState('activeMode', activeMode)
  }, [activeMode])

  useEffect(() => {
    persistState('profile', profile)
  }, [profile])

  useEffect(() => {
    persistState('likes', likes)
  }, [likes])

  useEffect(() => {
    persistState('passes', passes)
  }, [passes])

  useEffect(() => {
    persistState('matches', matches)
  }, [matches])

  useEffect(() => {
    persistState('messages', messages)
  }, [messages])

  const hiddenIds = useMemo(() => [...likes, ...passes], [likes, passes])

  const discoveryProfiles = useMemo(
    () => filterProfiles(demoProfiles, activeMode, cityFilter, interestFilter, hiddenIds),
    [activeMode, cityFilter, hiddenIds, interestFilter],
  )

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? matches[0] ?? null
  const selectedMessages = messages.filter((message) => message.matchId === selectedMatch?.id)
  const canLikeProfiles = isProfileComplete(profile)

  const handleModeChange = (mode: typeof activeMode) => {
    setActiveMode(mode)
    setFlashMessage(`Mode actif : ${modeLabels[mode]}`)
  }

  const handleProfileSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextProfile = { ...profile, interests: normalizeInterestInput(interestInput) }
    const errors = validateProfile(nextProfile)
    setProfileErrors(errors)

    if (Object.keys(errors).length) {
      setFlashMessage('Le profil contient des erreurs. Vérifiez les champs signalés.')
      return
    }

    setProfile(nextProfile)
    setActiveMode(nextProfile.mode ?? defaultMode)
    setFlashMessage('Profil enregistré localement dans votre navigateur.')
  }

  const handleLike = (profileId: string) => {
    const candidate = demoProfiles.find((item) => item.id === profileId)
    if (!candidate) return

    if (!canLikeProfiles) {
      setView('profile')
      setFlashMessage('Complétez votre profil avant d’envoyer des likes et de simuler un match.')
      return
    }

    setLikes((current) => (current.includes(profileId) ? current : [...current, profileId]))
    setPasses((current) => current.filter((id) => id !== profileId))

    if (matches.some((match) => match.demoProfileId === profileId)) {
      setFlashMessage(`Vous avez liké ${candidate.firstName}.`)
      return
    }

    if (isCompatibleMatch(profile, candidate)) {
      const newMatch = createMatch(candidate)
      setMatches((current) => [newMatch, ...current])
      setMessages((current) => [...createInitialConversation(candidate), ...current])
      setSelectedMatchId(newMatch.id)
      setView('matches')
      setFlashMessage(`C’est un match avec ${candidate.firstName} !`)
      return
    }

    setFlashMessage(`Like enregistré pour ${candidate.firstName}. Match simulé en attente.`)
  }

  const handlePass = (profileId: string) => {
    const candidate = demoProfiles.find((item) => item.id === profileId)
    setPasses((current) => (current.includes(profileId) ? current : [...current, profileId]))
    setFlashMessage(candidate ? `${candidate.firstName} a été passé.` : 'Profil ignoré.')
  }

  const handleMessageSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedMatch || !draftMessage.trim()) return

    setMessages((current) => [
      ...current,
      {
        id: `message-${selectedMatch.id}-${Date.now()}`,
        matchId: selectedMatch.id,
        author: 'me',
        content: draftMessage.trim(),
        createdAt: new Date().toISOString(),
      },
    ])
    setDraftMessage('')
  }

  const resetPrototype = () => {
    clearState()
    const refreshedState = loadState()
    setProfile(refreshedState.profile)
    setInterestInput('')
    setLikes(refreshedState.likes)
    setPasses(refreshedState.passes)
    setMatches(refreshedState.matches)
    setMessages(refreshedState.messages)
    setActiveMode(refreshedState.activeMode)
    setSelectedMatchId('')
    setProfileErrors(initialErrors)
    setStorageError(null)
    setFlashMessage('Les données locales du prototype ont été réinitialisées.')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Prototype local • sans backend • sans temps réel</p>
          <h1>Lifys</h1>
          <p className="subtitle">La rencontre multi-catégories, pensée pour démarrer vite et évoluer proprement.</p>
        </div>

        <label className="mode-picker">
          <span>Mode actif</span>
          <select value={activeMode} onChange={(event) => handleModeChange(event.target.value as typeof activeMode)}>
            {MODES.map((mode) => (
              <option key={mode} value={mode}>
                {modeLabels[mode]}
              </option>
            ))}
          </select>
        </label>
      </header>

      <nav className="main-nav" aria-label="Navigation principale">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === view ? 'nav-button nav-button-active' : 'nav-button'}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {storageError ? <div className="alert alert-error">{storageError}</div> : null}
      {flashMessage ? <div className="alert">{flashMessage}</div> : null}

      <main className="content-grid">
        {view === 'home' ? (
          <>
            <section className="hero-panel card">
              <div>
                <p className="section-kicker">MVP web responsive</p>
                <h2>Trouvez le bon contexte pour la bonne rencontre.</h2>
                <p>
                  Lifys réunit cinq modes : amical, amoureux, sans lendemain, mariage et professionnel.
                  Tout est stocké localement pour prototyper sans compte distant ni données sensibles.
                </p>
              </div>
              <div className="cta-row">
                <button type="button" className="primary-button" onClick={() => setView('discover')}>
                  Découvrir
                </button>
                <button type="button" className="secondary-button" onClick={() => setView('profile')}>
                  Créer mon profil
                </button>
              </div>
            </section>

            <section className="mode-grid" aria-label="Modes de rencontre Lifys">
              {MODES.map((mode) => (
                <article key={mode} className={mode === activeMode ? 'mode-card mode-card-active' : 'mode-card'}>
                  <div className="mode-badge">{modeLabels[mode]}</div>
                  <h3>{modeLabels[mode]}</h3>
                  <p>{modeDescriptions[mode]}</p>
                  <button type="button" className="link-button" onClick={() => handleModeChange(mode)}>
                    Activer ce mode
                  </button>
                </article>
              ))}
            </section>
          </>
        ) : null}

        {view === 'discover' ? (
          <>
            <section className="card filter-panel">
              <div>
                <p className="section-kicker">Découverte</p>
                <h2>Profils de démonstration</h2>
                <p>Filtrez par ville ou intérêt. Les likes, passes et matchs sont conservés localement.</p>
              </div>
              <div className="filter-row">
                <label>
                  <span>Ville</span>
                  <input value={cityFilter} onChange={(event) => setCityFilter(event.target.value)} placeholder="Ex. Lyon" />
                </label>
                <label>
                  <span>Intérêt</span>
                  <input
                    value={interestFilter}
                    onChange={(event) => setInterestFilter(event.target.value)}
                    placeholder="Ex. cuisine"
                  />
                </label>
              </div>
            </section>

            {!profile.firstName ? (
              <section className="card empty-state">
                <h3>Créez votre profil avant de matcher</h3>
                <p>Le matching simulé utilise votre ville, vos centres d’intérêt et votre mode principal.</p>
                <button type="button" className="primary-button" onClick={() => setView('profile')}>
                  Compléter mon profil
                </button>
              </section>
            ) : null}

            {discoveryProfiles.length ? (
              <section className="discover-grid">
                {discoveryProfiles.map((candidate) => (
                  <article
                    key={candidate.id}
                    className="card profile-card"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowRight') handleLike(candidate.id)
                      if (event.key === 'ArrowLeft') handlePass(candidate.id)
                    }}
                    aria-label={`Profil de ${candidate.firstName}, ${candidate.age} ans, ${candidate.city}`}
                  >
                    <ProfileAvatar name={candidate.firstName} imageUrl={candidate.avatarUrl} className="avatar" />
                    <div className="profile-card-content">
                      <div className="profile-heading">
                        <div>
                          <h3>
                            {candidate.firstName}, {candidate.age}
                          </h3>
                          <p>{candidate.city}</p>
                        </div>
                        <span className="mode-badge">{modeLabels[candidate.mode]}</span>
                      </div>
                      <p>{candidate.bio}</p>
                      <ul className="tag-list">
                        {candidate.interests.map((interest) => (
                          <li key={interest}>{interest}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="card-actions">
                      <button type="button" className="secondary-button" onClick={() => handlePass(candidate.id)}>
                        Pass
                      </button>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => handleLike(candidate.id)}
                        disabled={!canLikeProfiles}
                      >
                        Like
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            ) : (
              <section className="card empty-state">
                <h3>Aucun profil disponible</h3>
                <p>Essayez un autre mode ou allègez vos filtres pour voir de nouveaux profils.</p>
              </section>
            )}
          </>
        ) : null}

        {view === 'matches' ? (
          <section className="card list-panel">
            <div>
              <p className="section-kicker">Matchs</p>
              <h2>Vos connexions locales</h2>
            </div>
            {matches.length ? (
              <ul className="match-list">
                {matches.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      className="match-item"
                      onClick={() => {
                        setSelectedMatchId(match.id)
                        setView('messages')
                      }}
                    >
                      <ProfileAvatar name={match.firstName} imageUrl={match.avatarUrl} className="match-avatar" />
                      <div>
                        <strong>{match.firstName}</strong>
                        <span>
                          {match.city} • {modeLabels[match.mode]}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">
                <h3>Pas encore de match</h3>
                <p>Likez des profils compatibles pour déclencher des matchs simulés.</p>
                <button type="button" className="primary-button" onClick={() => setView('discover')}>
                  Aller à Découvrir
                </button>
              </div>
            )}
          </section>
        ) : null}

        {view === 'messages' ? (
          <section className="card messages-panel">
            <div className="messages-header">
              <div>
                <p className="section-kicker">Messages</p>
                <h2>Messagerie du prototype</h2>
                <p>Les conversations sont locales uniquement, sans temps réel ni envoi distant.</p>
              </div>
              {matches.length ? (
                <label>
                  <span>Conversation</span>
                  <select value={selectedMatch?.id ?? ''} onChange={(event) => setSelectedMatchId(event.target.value)}>
                    {matches.map((match) => (
                      <option key={match.id} value={match.id}>
                        {match.firstName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            {selectedMatch ? (
              <>
                <div className="message-thread" role="log" aria-live="polite">
                  {selectedMessages.map((message) => (
                    <div key={message.id} className={`message-bubble message-${message.author}`}>
                      {message.content}
                    </div>
                  ))}
                </div>
                <form className="message-form" onSubmit={handleMessageSubmit}>
                  <label className="sr-only" htmlFor="message-input">
                    Nouveau message
                  </label>
                  <input
                    id="message-input"
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    placeholder={`Écrire à ${selectedMatch.firstName}`}
                  />
                  <button type="submit" className="primary-button">
                    Envoyer
                  </button>
                </form>
              </>
            ) : (
              <div className="empty-state">
                <h3>Aucune conversation</h3>
                <p>Créez d’abord un match pour ouvrir une conversation de démonstration.</p>
              </div>
            )}
          </section>
        ) : null}

        {view === 'profile' ? (
          <section className="card profile-panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Profil local</p>
                <h2>Onboarding MVP</h2>
              </div>
              <button type="button" className="secondary-button" onClick={resetPrototype}>
                Réinitialiser les données locales
              </button>
            </div>

            <form className="profile-form" onSubmit={handleProfileSubmit} noValidate>
              <label>
                <span>Prénom *</span>
                <input
                  value={profile.firstName}
                  onChange={(event) => setProfile((current) => ({ ...current, firstName: event.target.value }))}
                  aria-invalid={Boolean(profileErrors.firstName)}
                />
                {profileErrors.firstName ? <small>{profileErrors.firstName}</small> : null}
              </label>

              <label>
                <span>Âge *</span>
                <input
                  type="number"
                  min="18"
                  max="99"
                  value={profile.age}
                  onChange={(event) => setProfile((current) => ({ ...current, age: Number(event.target.value) || '' }))}
                  aria-invalid={Boolean(profileErrors.age)}
                />
                {profileErrors.age ? <small>{profileErrors.age}</small> : null}
              </label>

              <label>
                <span>Ville *</span>
                <input
                  value={profile.city}
                  onChange={(event) => setProfile((current) => ({ ...current, city: event.target.value }))}
                  aria-invalid={Boolean(profileErrors.city)}
                />
                {profileErrors.city ? <small>{profileErrors.city}</small> : null}
              </label>

              <label>
                <span>Mode principal *</span>
                <select
                  value={profile.mode}
                  onChange={(event) => setProfile((current) => ({ ...current, mode: event.target.value as Profile['mode'] }))}
                >
                  {MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {modeLabels[mode]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="full-width">
                <span>Courte bio *</span>
                <textarea
                  rows={4}
                  value={profile.bio}
                  onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
                  aria-invalid={Boolean(profileErrors.bio)}
                />
                {profileErrors.bio ? <small>{profileErrors.bio}</small> : null}
              </label>

              <label className="full-width">
                <span>Centres d’intérêt *</span>
                <input
                  value={interestInput}
                  onChange={(event) => setInterestInput(event.target.value)}
                  placeholder="Ex. design, cuisine, running"
                  aria-invalid={Boolean(profileErrors.interests)}
                />
                {profileErrors.interests ? <small>{profileErrors.interests}</small> : null}
              </label>

              <label className="full-width">
                <span>Photo / avatar URL (facultatif)</span>
                <input
                  value={profile.avatarUrl}
                  onChange={(event) => setProfile((current) => ({ ...current, avatarUrl: event.target.value }))}
                  placeholder="https://..."
                  aria-invalid={Boolean(profileErrors.avatarUrl)}
                />
                {profileErrors.avatarUrl ? <small>{profileErrors.avatarUrl}</small> : null}
              </label>

              <div className="form-footer full-width">
                <p>* Données enregistrées uniquement dans votre navigateur.</p>
                <button type="submit" className="primary-button">
                  Enregistrer mon profil
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App

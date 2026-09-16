import type { DemoProfile, Match, Message, Mode, Profile } from '../types'

export const defaultProfile: Profile = {
  firstName: '',
  age: '',
  city: '',
  bio: '',
  interests: [],
  avatarUrl: '',
  mode: 'amical',
}

export const defaultMode: Mode = 'amical'

export const normalizeInterestInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

export const serializeInterestInput = (interests: string[]) => interests.join(', ')

const includesQuery = (value: string, query: string) => value.toLowerCase().includes(query.trim().toLowerCase())

export const filterProfiles = (
  profiles: DemoProfile[],
  activeMode: Mode,
  cityQuery: string,
  interestQuery: string,
  hiddenIds: string[] = [],
) => {
  const normalizedInterest = interestQuery.trim().toLowerCase()
  const hidden = new Set(hiddenIds)

  return profiles.filter((profile) => {
    if (hidden.has(profile.id) || profile.mode !== activeMode) {
      return false
    }

    const matchesCity = !cityQuery.trim() || includesQuery(profile.city, cityQuery)
    const matchesInterest =
      !normalizedInterest || profile.interests.some((interest) => includesQuery(interest, normalizedInterest))

    return matchesCity && matchesInterest
  })
}

export const isProfileComplete = (profile: Profile) =>
  Boolean(profile.firstName.trim() && profile.city.trim() && profile.bio.trim() && profile.age && profile.interests.length)

export const validateProfile = (profile: Profile) => {
  const errors: Partial<Record<keyof Profile, string>> = {}

  if (!profile.firstName.trim()) {
    errors.firstName = 'Le prénom est requis.'
  }

  if (!profile.age || profile.age < 18 || profile.age > 99) {
    errors.age = 'L’âge doit être compris entre 18 et 99 ans.'
  }

  if (!profile.city.trim()) {
    errors.city = 'La ville est requise.'
  }

  if (!profile.bio.trim()) {
    errors.bio = 'Ajoutez une courte bio pour rendre votre profil plus humain.'
  }

  if (!profile.interests.length) {
    errors.interests = 'Ajoutez au moins un centre d’intérêt.'
  }

  if (profile.avatarUrl && !/^https?:\/\//i.test(profile.avatarUrl)) {
    errors.avatarUrl = 'Utilisez une URL commençant par http:// ou https://.'
  }

  return errors
}

export const isCompatibleMatch = (profile: Profile, candidate: DemoProfile) => {
  if (!isProfileComplete(profile) || profile.mode !== candidate.mode) {
    return false
  }

  const sameCity = profile.city.trim().toLowerCase() === candidate.city.trim().toLowerCase()
  const sharedInterest = profile.interests.some((interest) =>
    candidate.interests.some((candidateInterest) => candidateInterest.toLowerCase() === interest.toLowerCase()),
  )

  return sameCity || sharedInterest
}

export const createMatch = (candidate: DemoProfile): Match => ({
  id: `match-${candidate.id}`,
  demoProfileId: candidate.id,
  firstName: candidate.firstName,
  city: candidate.city,
  mode: candidate.mode,
  avatarUrl: candidate.avatarUrl,
  createdAt: new Date().toISOString(),
})

export const createInitialConversation = (candidate: DemoProfile): Message[] => [
  {
    id: `intro-${candidate.id}`,
    matchId: `match-${candidate.id}`,
    author: 'system',
    content: `C’est un match avec ${candidate.firstName} sur Lifys. Prototype local uniquement.`,
    createdAt: new Date().toISOString(),
  },
  {
    id: `hello-${candidate.id}`,
    matchId: `match-${candidate.id}`,
    author: 'them',
    content: `Salut ! J’ai vu qu’on partage ${candidate.interests[0]}. On échange ?`,
    createdAt: new Date().toISOString(),
  },
]

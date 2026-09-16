import { demoProfiles } from '../data/demoProfiles'
import { createInitialConversation, defaultMode, defaultProfile } from './matching'
import type { Match, Message, Mode, Profile } from '../types'

const STORAGE_KEYS = {
  activeMode: 'lifys.activeMode',
  likes: 'lifys.likes',
  matches: 'lifys.matches',
  messages: 'lifys.messages',
  passes: 'lifys.passes',
  profile: 'lifys.profile',
} as const

export type PersistedState = {
  activeMode: Mode
  likes: string[]
  matches: Match[]
  messages: Message[]
  passes: string[]
  profile: Profile
  error?: string
}

const fallbackState: PersistedState = {
  activeMode: defaultMode,
  likes: [],
  matches: [],
  messages: [],
  passes: [],
  profile: defaultProfile,
}

const readJson = <T,>(key: string, fallback: T) => {
  const raw = window.localStorage.getItem(key)
  if (!raw) {
    return fallback
  }

  return JSON.parse(raw) as T
}

export const loadState = (): PersistedState => {
  if (typeof window === 'undefined') {
    return fallbackState
  }

  try {
    const matches = readJson<Match[]>(STORAGE_KEYS.matches, [])
    const messages = readJson<Message[]>(STORAGE_KEYS.messages, [])

    return {
      activeMode: readJson<Mode>(STORAGE_KEYS.activeMode, defaultMode),
      likes: readJson<string[]>(STORAGE_KEYS.likes, []),
      matches,
      messages: messages.length
        ? messages
        : matches.flatMap((match) => {
            const demoProfile = demoProfiles.find((profile) => profile.id === match.demoProfileId)
            return demoProfile ? createInitialConversation(demoProfile) : []
          }),
      passes: readJson<string[]>(STORAGE_KEYS.passes, []),
      profile: readJson<Profile>(STORAGE_KEYS.profile, defaultProfile),
    }
  } catch {
    return {
      ...fallbackState,
      error: 'Le stockage local semblait corrompu. Lifys a rechargé un état sain.',
    }
  }
}

export const persistState = <T,>(key: keyof typeof STORAGE_KEYS, value: T) => {
  window.localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value))
}

export const clearState = () => {
  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key))
}

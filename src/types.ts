export const MODES = ['amical', 'amoureux', 'sans lendemain', 'mariage', 'professionnel'] as const

export type Mode = (typeof MODES)[number]
export type View = 'home' | 'discover' | 'matches' | 'messages' | 'profile'

export type Profile = {
  firstName: string
  age: number | ''
  city: string
  bio: string
  interests: string[]
  avatarUrl: string
  mode: Mode
}

export type DemoProfile = {
  id: string
  firstName: string
  age: number
  city: string
  bio: string
  interests: string[]
  avatarUrl: string
  mode: Mode
}

export type Match = {
  id: string
  demoProfileId: string
  firstName: string
  city: string
  mode: Mode
  avatarUrl: string
  createdAt: string
}

export type Message = {
  id: string
  matchId: string
  author: 'me' | 'them' | 'system'
  content: string
  createdAt: string
}

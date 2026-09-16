import { describe, expect, it } from 'vitest'
import { demoProfiles } from '../data/demoProfiles'
import {
  createMatch,
  filterProfiles,
  isCompatibleMatch,
  normalizeInterestInput,
  validateProfile,
} from './matching'

describe('matching helpers', () => {
  it('filters demo profiles by active mode, city, interests and hidden ids', () => {
    const results = filterProfiles(demoProfiles, 'professionnel', 'bordeaux', 'mentor', ['camille-bordeaux-pro'])

    expect(results.map((profile) => profile.id)).toEqual(['maya-bordeaux-pro'])
  })

  it('creates simulated matches only for compatible profiles', () => {
    const candidate = demoProfiles.find((profile) => profile.id === 'hugo-lille-mariage')
    expect(candidate).toBeDefined()

    expect(
      isCompatibleMatch(
        {
          firstName: 'Amina',
          age: 33,
          city: 'Lille',
          bio: 'Relation sérieuse et bienveillante.',
          interests: ['famille', 'lecture'],
          avatarUrl: '',
          mode: 'mariage',
        },
        candidate!,
      ),
    ).toBe(true)

    expect(
      isCompatibleMatch(
        {
          firstName: 'Amina',
          age: 33,
          city: 'Nice',
          bio: 'Relation sérieuse et bienveillante.',
          interests: ['surf'],
          avatarUrl: '',
          mode: 'mariage',
        },
        candidate!,
      ),
    ).toBe(false)
  })

  it('validates essential profile fields and normalizes interests', () => {
    expect(normalizeInterestInput(' Product,  Mentoring , ')).toEqual(['product', 'mentoring'])

    const errors = validateProfile({
      firstName: '',
      age: 14,
      city: '',
      bio: '',
      interests: [],
      avatarUrl: 'avatar',
      mode: 'amical',
    })

    expect(errors).toMatchObject({
      firstName: expect.any(String),
      age: expect.any(String),
      city: expect.any(String),
      bio: expect.any(String),
      interests: expect.any(String),
      avatarUrl: expect.any(String),
    })
  })

  it('creates stable match identifiers', () => {
    const candidate = demoProfiles[0]
    expect(createMatch(candidate)).toMatchObject({
      id: `match-${candidate.id}`,
      demoProfileId: candidate.id,
      firstName: candidate.firstName,
    })
  })
})

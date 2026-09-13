import request from 'supertest';
import { signAccessToken } from '../src/lib/tokens';

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async ({ where: { id } }: any) => {
        if (id !== 'user-2') {
          return null;
        }

        return {
          id: 'user-2',
          email: 'private@example.com',
          phone: '+33123456789',
          passwordHash: 'hash',
          firstName: 'Bob',
          age: 31,
          gender: 'M',
          bio: 'Bio',
          interests: ['tech'],
          location: 'Paris',
          latitude: 48.85,
          longitude: 2.35,
          categories: ['PROFESSIONNEL'],
          verificationStatus: 'EMAIL_VERIFIED',
          photos: [],
          categoryProfiles: [],
          createdAt: new Date('2030-01-01T10:00:00.000Z'),
          updatedAt: new Date('2030-01-01T10:00:00.000Z'),
        };
      }),
      update: jest.fn(),
    },
    photo: {
      count: jest.fn(async () => 0),
      create: jest.fn(),
    },
    match: {
      findMany: jest.fn(async () => []),
    },
    block: {
      upsert: jest.fn(),
    },
  },
}));

// eslint-disable-next-line import/first
import { createApp } from '../src/index';

describe('user routes', () => {
  const app = createApp();
  const authHeader = {
    Authorization: ['Bearer', signAccessToken({ userId: 'user-1', email: 'alice@example.com' })].join(' '),
  };

  it('returns a public profile projection', async () => {
    const res = await request(app).get('/users/user-2').set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('user-2');
    expect(res.body.firstName).toBe('Bob');
    expect(res.body.email).toBeUndefined();
    expect(res.body.phone).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
  });
});

import request from 'supertest';

jest.mock('../src/lib/prisma', () => {
  const users = new Map<string, any>();
  return {
    prisma: {
      user: {
        findUnique: jest.fn(async ({ where: { email, id } }: any) => {
          if (email) return users.get(email) ?? null;
          if (id) return [...users.values()].find((u) => u.id === id) ?? null;
          return null;
        }),
        create: jest.fn(async ({ data }: any) => {
          const user = { id: `user-${users.size + 1}`, ...data, createdAt: new Date(), updatedAt: new Date() };
          users.set(user.email, user);
          return user;
        }),
      },
    },
  };
});

// eslint-disable-next-line import/first
import { createApp } from '../src/index';

describe('POST /auth/register and /auth/login', () => {
  const app = createApp();

  it('registers a new user and returns tokens', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'alice@example.com',
      password: 'password123',
      firstName: 'Alice',
      age: 28,
      categories: ['AMICAL'],
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('rejects registration with an invalid category', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'bob@example.com',
      password: 'password123',
      firstName: 'Bob',
      age: 30,
      categories: ['NOT_A_CATEGORY'],
    });

    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/auth/register').send({
      email: 'carol@example.com',
      password: 'password123',
      firstName: 'Carol',
      age: 25,
      categories: ['AMOUREUX'],
    });

    const res = await request(app).post('/auth/login').send({
      email: 'carol@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'carol@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
  });
});

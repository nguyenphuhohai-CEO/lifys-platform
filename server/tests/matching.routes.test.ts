import request from 'supertest';
import { signAccessToken } from '../src/lib/tokens';

const users = [
  {
    id: 'user-1',
    email: 'alice@example.com',
    passwordHash: 'hash',
    firstName: 'Alice',
    age: 29,
    categories: ['AMOUREUX'],
    photos: [],
  },
  {
    id: 'user-2',
    email: 'bob@example.com',
    passwordHash: 'hash',
    firstName: 'Bob',
    age: 24,
    categories: ['AMOUREUX'],
    photos: [],
  },
  {
    id: 'user-3',
    email: 'charlie@example.com',
    passwordHash: 'hash',
    firstName: 'Charlie',
    age: 37,
    categories: ['AMOUREUX'],
    photos: [],
  },
];

const likes: Array<{ senderId: string; receiverId: string; category: string; isSuperLike: boolean }> = [];
const blocks: Array<{ blockerId: string; blockedId: string }> = [];

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    like: {
      findMany: jest.fn(async ({ where: { senderId, category } }: any) =>
        likes
          .filter((like) => like.senderId === senderId && like.category === category)
          .map((like) => ({ receiverId: like.receiverId }))
      ),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const key = where.senderId_receiverId_category;
        const existing = likes.find(
          (like) =>
            like.senderId === key.senderId &&
            like.receiverId === key.receiverId &&
            like.category === key.category
        );

        if (existing) {
          existing.isSuperLike = update.isSuperLike;
          return existing;
        }

        likes.push(create);
        return create;
      }),
      findUnique: jest.fn(async ({ where: { senderId_receiverId_category: key } }: any) =>
        likes.find(
          (like) =>
            like.senderId === key.senderId &&
            like.receiverId === key.receiverId &&
            like.category === key.category
        ) ?? null
      ),
    },
    block: {
      findMany: jest.fn(async ({ where: { OR } }: any) =>
        blocks.filter(
          (block) =>
            OR.some((condition: any) =>
              (condition.blockerId === undefined || block.blockerId === condition.blockerId) &&
              (condition.blockedId === undefined || block.blockedId === condition.blockedId)
            )
        )
      ),
      findFirst: jest.fn(async ({ where: { OR } }: any) =>
        blocks.find((block) =>
          OR.some(
            (condition: any) =>
              block.blockerId === condition.blockerId && block.blockedId === condition.blockedId
          )
        ) ?? null
      ),
    },
    user: {
      findMany: jest.fn(async ({ where }: any) =>
        users.filter((user) => {
          if (where.id?.notIn?.includes(user.id)) return false;
          if (where.categories?.has && !user.categories.includes(where.categories.has)) return false;
          if (where.age?.gte !== undefined && user.age < where.age.gte) return false;
          if (where.age?.lte !== undefined && user.age > where.age.lte) return false;
          return true;
        })
      ),
    },
    match: {
      upsert: jest.fn(async ({ create }: any) => ({ id: 'match-1', status: 'MATCHED', ...create })),
      findMany: jest.fn(async () => []),
    },
  },
}));

// eslint-disable-next-line import/first
import { createApp } from '../src/index';

describe('matching routes', () => {
  const app = createApp();
  const authHeader = {
    Authorization: ['Bearer', signAccessToken({ userId: 'user-1', email: 'alice@example.com' })].join(' '),
  };

  beforeEach(() => {
    likes.length = 0;
    blocks.length = 0;
  });

  it('rejects invalid discover categories', async () => {
    const res = await request(app).get('/discover?category=INVALID').set(authHeader);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('category must be one of');
  });

  it('filters discovery results by age range', async () => {
    const res = await request(app).get('/discover?category=AMOUREUX&minAge=23&maxAge=30').set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('user-2');
  });

  it('rejects invalid numeric age filters', async () => {
    const res = await request(app).get('/discover?category=AMOUREUX&minAge=abc').set(authHeader);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('minAge must be a valid number');
  });

  it('rejects empty age filters', async () => {
    const res = await request(app).get('/discover?category=AMOUREUX&minAge=').set(authHeader);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('minAge must be a valid number');
  });

  it('rejects inverted age ranges', async () => {
    const res = await request(app).get('/discover?category=AMOUREUX&minAge=40&maxAge=20').set(authHeader);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('minAge must be less than or equal to maxAge');
  });

  it('blocks likes when either user has blocked the other', async () => {
    blocks.push({ blockerId: 'user-2', blockedId: 'user-1' });

    const res = await request(app).post('/likes/user-2').set(authHeader).send({ category: 'AMOUREUX' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Cannot interact with a blocked user');
  });

  it('blocks super-likes when either user has blocked the other', async () => {
    blocks.push({ blockerId: 'user-1', blockedId: 'user-2' });

    const res = await request(app)
      .post('/super-likes/user-2')
      .set(authHeader)
      .send({ category: 'AMOUREUX' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Cannot interact with a blocked user');
  });
});

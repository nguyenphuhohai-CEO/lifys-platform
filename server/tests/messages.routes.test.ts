import request from 'supertest';
import { signAccessToken } from '../src/lib/tokens';

const matches = new Map<
  string,
  { id: string; userOneId: string; userTwoId: string; status: 'MATCHED' | 'BLOCKED' | 'PENDING' }
>();
const createdMessages: Array<{ matchId: string; senderId: string; receiverId: string; content: string }> = [];

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    match: {
      findUnique: jest.fn(async ({ where: { id } }: any) => matches.get(id) ?? null),
    },
    message: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: any) => {
        createdMessages.push(data);
        return { id: `message-${createdMessages.length}`, ...data };
      }),
    },
  },
}));

// eslint-disable-next-line import/first
import { createApp } from '../src/index';

describe('message routes', () => {
  const app = createApp();
  const authHeader = {
    Authorization: ['Bearer', signAccessToken({ userId: 'user-1', email: 'alice@example.com' })].join(' '),
  };

  beforeEach(() => {
    matches.clear();
    createdMessages.length = 0;
  });

  it('rejects sending a message to an inactive conversation', async () => {
    matches.set('match-1', {
      id: 'match-1',
      userOneId: 'user-1',
      userTwoId: 'user-2',
      status: 'BLOCKED',
    });

    const res = await request(app).post('/messages/match-1').set(authHeader).send({
      content: 'Bonjour',
      type: 'TEXT',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conversation is not active');
    expect(createdMessages).toHaveLength(0);
  });

  it('rejects reading messages from an inactive conversation', async () => {
    matches.set('match-1', {
      id: 'match-1',
      userOneId: 'user-1',
      userTwoId: 'user-2',
      status: 'PENDING',
    });

    const res = await request(app).get('/messages/match-1').set(authHeader);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conversation is not active');
  });
});

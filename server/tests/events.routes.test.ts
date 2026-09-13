import request from 'supertest';
import { signAccessToken } from '../src/lib/tokens';

const events = new Map<
  string,
  {
    id: string;
    creatorId: string;
    category: string;
    title: string;
    description?: string;
    location?: string;
    dateTime: Date;
    maxAttendees?: number;
  }
>();
const attendees = new Map<string, { id: string; eventId: string; userId: string }>();

jest.mock('../src/lib/prisma', () => ({
  prisma: {
    event: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: any) => {
        const event = { id: `event-${events.size + 1}`, ...data };
        events.set(event.id, event);
        return event;
      }),
      findUnique: jest.fn(async ({ where: { id } }: any) => events.get(id) ?? null),
    },
    eventAttendee: {
      findUnique: jest.fn(async ({ where: { eventId_userId } }: any) => {
        for (const attendee of attendees.values()) {
          if (
            attendee.eventId === eventId_userId.eventId &&
            attendee.userId === eventId_userId.userId
          ) {
            return attendee;
          }
        }
        return null;
      }),
      count: jest.fn(async ({ where: { eventId } }: any) =>
        [...attendees.values()].filter((attendee) => attendee.eventId === eventId).length
      ),
      create: jest.fn(async ({ data }: any) => {
        const attendee = { id: `attendee-${attendees.size + 1}`, ...data };
        attendees.set(attendee.id, attendee);
        return attendee;
      }),
    },
    $transaction: jest.fn(async (callback: any) =>
      callback({
        event: {
          findUnique: async ({ where: { id } }: any) => {
            const event = events.get(id);
            if (!event) return null;
            return { id: event.id, maxAttendees: event.maxAttendees };
          },
        },
        eventAttendee: {
          findUnique: async ({ where: { eventId_userId } }: any) => {
            for (const attendee of attendees.values()) {
              if (
                attendee.eventId === eventId_userId.eventId &&
                attendee.userId === eventId_userId.userId
              ) {
                return attendee;
              }
            }
            return null;
          },
          count: async ({ where: { eventId } }: any) =>
            [...attendees.values()].filter((attendee) => attendee.eventId === eventId).length,
          create: async ({ data }: any) => {
            const attendee = { id: `attendee-${attendees.size + 1}`, ...data };
            attendees.set(attendee.id, attendee);
            return attendee;
          },
        },
      })
    ),
  },
}));

// eslint-disable-next-line import/first
import { createApp } from '../src/index';

describe('event routes', () => {
  const app = createApp();
  const authHeader = {
    Authorization: ['Bearer', signAccessToken({ userId: 'user-1', email: 'alice@example.com' })].join(' '),
  };

  beforeEach(() => {
    events.clear();
    attendees.clear();
  });

  it('creates an event with valid data', async () => {
    const res = await request(app).post('/events').set(authHeader).send({
      category: 'AMICAL',
      title: 'Brunch du dimanche',
      description: 'Rencontre conviviale',
      location: 'Paris',
      dateTime: '2030-01-01T10:00:00.000Z',
      maxAttendees: 12,
    });

    expect(res.status).toBe(201);
    expect(res.body.creatorId).toBe('user-1');
    expect(res.body.title).toBe('Brunch du dimanche');
  });

  it('rejects invalid event payloads', async () => {
    const res = await request(app).post('/events').set(authHeader).send({
      category: 'AMICAL',
      title: '',
      dateTime: 'not-a-date',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
  });

  it('prevents RSVP when an event is full', async () => {
    events.set('event-1', {
      id: 'event-1',
      creatorId: 'user-2',
      category: 'AMICAL',
      title: 'Atelier',
      dateTime: new Date('2030-01-01T10:00:00.000Z'),
      maxAttendees: 1,
    });
    attendees.set('attendee-1', { id: 'attendee-1', eventId: 'event-1', userId: 'user-2' });

    const res = await request(app).post('/events/event-1/rsvp').set(authHeader).send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Event is full');
  });

  it('returns the existing RSVP when the same user posts twice', async () => {
    events.set('event-1', {
      id: 'event-1',
      creatorId: 'user-2',
      category: 'AMICAL',
      title: 'Atelier',
      dateTime: new Date('2030-01-01T10:00:00.000Z'),
      maxAttendees: 5,
    });

    const first = await request(app).post('/events/event-1/rsvp').set(authHeader).send({});
    const second = await request(app).post('/events/event-1/rsvp').set(authHeader).send({});

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(attendees.size).toBe(1);
  });
});

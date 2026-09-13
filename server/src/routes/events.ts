import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { DATING_CATEGORIES, isValidCategory } from '../lib/categories';

const router = Router();

router.get('/', async (req, res) => {
  const category = req.query.category;
  const location = typeof req.query.location === 'string' ? req.query.location : undefined;

  if (category !== undefined && !isValidCategory(category)) {
    return res.status(400).json({ error: `category must be one of ${DATING_CATEGORIES.join(', ')}` });
  }

  const events = await prisma.event.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
      dateTime: { gte: new Date() },
    },
    include: { attendees: true },
    orderBy: { dateTime: 'asc' },
  });

  return res.json(events);
});

const createEventSchema = z.object({
  category: z.enum(DATING_CATEGORIES),
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.string().optional(),
  dateTime: z.string().datetime(),
  maxAttendees: z.number().int().positive().optional(),
});

class EventRouteError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: Record<string, unknown>
  ) {
    super(typeof payload.error === 'string' ? payload.error : 'Event route error');
  }
}

router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const event = await prisma.event.create({
    data: {
      creatorId: req.userId as string,
      category: parsed.data.category,
      title: parsed.data.title,
      description: parsed.data.description,
      location: parsed.data.location,
      dateTime: new Date(parsed.data.dateTime),
      maxAttendees: parsed.data.maxAttendees,
    },
  });

  return res.status(201).json(event);
});

router.post('/:id/rsvp', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const attendee = await prisma.$transaction(
      async (tx) => {
        const event = await tx.event.findUnique({
          where: { id: req.params.id },
          select: { id: true, maxAttendees: true },
        });

        if (!event) {
          throw new EventRouteError(404, { error: 'Event not found' });
        }

        const existingAttendee = await tx.eventAttendee.findUnique({
          where: { eventId_userId: { eventId: req.params.id, userId: req.userId as string } },
        });

        if (existingAttendee) {
          return existingAttendee;
        }

        if (event.maxAttendees !== null && event.maxAttendees !== undefined) {
          const attendeeCount = await tx.eventAttendee.count({
            where: { eventId: req.params.id },
          });

          if (attendeeCount >= event.maxAttendees) {
            throw new EventRouteError(400, { error: 'Event is full' });
          }
        }

        return tx.eventAttendee.create({
          data: { eventId: req.params.id, userId: req.userId as string },
        });
      },
      { isolationLevel: 'Serializable' }
    );

    return res.status(201).json(attendee);
  } catch (error) {
    if (error instanceof EventRouteError) {
      return res.status(error.status).json(error.payload);
    }

    throw error;
  }
});

export default router;

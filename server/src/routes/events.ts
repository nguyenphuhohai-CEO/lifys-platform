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
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: { attendees: true },
  });

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  if (event.maxAttendees && event.attendees.length >= event.maxAttendees) {
    return res.status(400).json({ error: 'Event is full' });
  }

  const attendee = await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId: req.params.id, userId: req.userId as string } },
    update: {},
    create: { eventId: req.params.id, userId: req.userId as string },
  });

  return res.status(201).json(attendee);
});

export default router;

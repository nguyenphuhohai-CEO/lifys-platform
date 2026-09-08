import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { DATING_CATEGORIES } from '../lib/categories';

const router = Router();

router.get('/:id', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { photos: true, categoryProfiles: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { passwordHash, ...safeUser } = user;
  return res.json(safeUser);
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  bio: z.string().max(1000).optional(),
  interests: z.array(z.string()).optional(),
  location: z.string().optional(),
  categories: z.array(z.enum(DATING_CATEGORIES)).min(1).max(5).optional(),
});

router.put('/:id/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.id) {
    return res.status(403).json({ error: 'Cannot edit another user profile' });
  }

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: parsed.data,
  });

  const { passwordHash, ...safeUser } = user;
  return res.json(safeUser);
});

const addPhotoSchema = z.object({
  url: z.string().url(),
  isPrimary: z.boolean().optional(),
});

router.post('/:id/photos', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.id) {
    return res.status(403).json({ error: 'Cannot add photos to another user profile' });
  }

  const parsed = addPhotoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const photoCount = await prisma.photo.count({ where: { userId: req.params.id } });
  if (photoCount >= 10) {
    return res.status(400).json({ error: 'Maximum of 10 photos allowed' });
  }

  const photo = await prisma.photo.create({
    data: {
      userId: req.params.id,
      url: parsed.data.url,
      isPrimary: parsed.data.isPrimary ?? photoCount === 0,
    },
  });

  return res.status(201).json(photo);
});

router.get('/:id/matches', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.id) {
    return res.status(403).json({ error: 'Cannot view matches of another user' });
  }

  const category = typeof req.query.category === 'string' ? req.query.category : undefined;

  const matches = await prisma.match.findMany({
    where: {
      status: 'MATCHED',
      ...(category ? { category: category as never } : {}),
      OR: [{ userOneId: req.params.id }, { userTwoId: req.params.id }],
    },
    include: { userOne: true, userTwo: true },
  });

  return res.json(
    matches.map((match) => {
      const other = match.userOneId === req.params.id ? match.userTwo : match.userOne;
      const { passwordHash, ...safeOther } = other;
      return { id: match.id, category: match.category, createdAt: match.createdAt, user: safeOther };
    })
  );
});

const blockSchema = z.object({
  reason: z.string().optional(),
});

router.post('/:id/block/:blockedId', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.id) {
    return res.status(403).json({ error: 'Cannot block on behalf of another user' });
  }

  if (req.params.id === req.params.blockedId) {
    return res.status(400).json({ error: 'Cannot block yourself' });
  }

  const parsed = blockSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const block = await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: req.params.id, blockedId: req.params.blockedId } },
    update: { reason: parsed.data.reason },
    create: {
      blockerId: req.params.id,
      blockedId: req.params.blockedId,
      reason: parsed.data.reason,
    },
  });

  return res.status(201).json(block);
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { DATING_CATEGORIES, isValidCategory } from '../lib/categories';

const router = Router();

router.get('/discover', requireAuth, async (req: AuthenticatedRequest, res) => {
  const category = req.query.category;
  if (!isValidCategory(category)) {
    return res.status(400).json({ error: `category must be one of ${DATING_CATEGORIES.join(', ')}` });
  }

  const minAge = req.query.minAge ? Number(req.query.minAge) : undefined;
  const maxAge = req.query.maxAge ? Number(req.query.maxAge) : undefined;

  const [likedIds, blockedIds] = await Promise.all([
    prisma.like.findMany({ where: { senderId: req.userId, category }, select: { receiverId: true } }),
    prisma.block.findMany({
      where: { OR: [{ blockerId: req.userId }, { blockedId: req.userId }] },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  const excludedIds = new Set<string>([
    req.userId as string,
    ...likedIds.map((l) => l.receiverId),
    ...blockedIds.map((b) => (b.blockerId === req.userId ? b.blockedId : b.blockerId)),
  ]);

  const candidates = await prisma.user.findMany({
    where: {
      id: { notIn: Array.from(excludedIds) },
      categories: { has: category },
      ...(minAge !== undefined || maxAge !== undefined
        ? { age: { gte: minAge ?? 0, lte: maxAge ?? 200 } }
        : {}),
    },
    include: { photos: true },
    take: 20,
  });

  return res.json(
    candidates.map(({ passwordHash, ...safeUser }) => safeUser)
  );
});

async function createLikeAndMaybeMatch(
  senderId: string,
  receiverId: string,
  category: string,
  isSuperLike: boolean
) {
  const like = await prisma.like.upsert({
    where: { senderId_receiverId_category: { senderId, receiverId, category: category as never } },
    update: { isSuperLike },
    create: { senderId, receiverId, category: category as never, isSuperLike },
  });

  const reciprocalLike = await prisma.like.findUnique({
    where: {
      senderId_receiverId_category: {
        senderId: receiverId,
        receiverId: senderId,
        category: category as never,
      },
    },
  });

  let match = null;
  if (reciprocalLike) {
    const [userOneId, userTwoId] = [senderId, receiverId].sort();
    match = await prisma.match.upsert({
      where: { userOneId_userTwoId_category: { userOneId, userTwoId, category: category as never } },
      update: { status: 'MATCHED' },
      create: { userOneId, userTwoId, category: category as never, status: 'MATCHED' },
    });
  }

  return { like, match };
}

const likeParamsSchema = z.object({
  category: z.enum(DATING_CATEGORIES),
});

router.post('/likes/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = likeParamsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'category is required in the request body' });
  }

  if (req.userId === req.params.userId) {
    return res.status(400).json({ error: 'Cannot like yourself' });
  }

  const result = await createLikeAndMaybeMatch(
    req.userId as string,
    req.params.userId,
    parsed.data.category,
    false
  );

  return res.status(201).json(result);
});

router.post('/super-likes/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = likeParamsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'category is required in the request body' });
  }

  if (req.userId === req.params.userId) {
    return res.status(400).json({ error: 'Cannot super-like yourself' });
  }

  const result = await createLikeAndMaybeMatch(
    req.userId as string,
    req.params.userId,
    parsed.data.category,
    true
  );

  return res.status(201).json(result);
});

router.get('/matches', requireAuth, async (req: AuthenticatedRequest, res) => {
  const category = req.query.category;
  if (category !== undefined && !isValidCategory(category)) {
    return res.status(400).json({ error: `category must be one of ${DATING_CATEGORIES.join(', ')}` });
  }

  const matches = await prisma.match.findMany({
    where: {
      status: 'MATCHED',
      ...(category ? { category } : {}),
      OR: [{ userOneId: req.userId }, { userTwoId: req.userId }],
    },
    include: { userOne: true, userTwo: true },
  });

  return res.json(
    matches.map((match) => {
      const other = match.userOneId === req.userId ? match.userTwo : match.userOne;
      const { passwordHash, ...safeOther } = other;
      return { id: match.id, category: match.category, createdAt: match.createdAt, user: safeOther };
    })
  );
});

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

router.get('/:conversationId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const match = await prisma.match.findUnique({ where: { id: req.params.conversationId } });
  if (!match) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (match.userOneId !== req.userId && match.userTwoId !== req.userId) {
    return res.status(403).json({ error: 'Not part of this conversation' });
  }

  const messages = await prisma.message.findMany({
    where: { matchId: req.params.conversationId },
    orderBy: { createdAt: 'asc' },
  });

  return res.json(messages);
});

const sendMessageSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO']).default('TEXT'),
});

router.post('/:conversationId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const match = await prisma.match.findUnique({ where: { id: req.params.conversationId } });
  if (!match) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (match.userOneId !== req.userId && match.userTwoId !== req.userId) {
    return res.status(403).json({ error: 'Not part of this conversation' });
  }

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const receiverId = match.userOneId === req.userId ? match.userTwoId : match.userOneId;

  const message = await prisma.message.create({
    data: {
      matchId: match.id,
      senderId: req.userId as string,
      receiverId,
      content: parsed.data.content,
      type: parsed.data.type,
    },
  });

  return res.status(201).json(message);
});

export default router;

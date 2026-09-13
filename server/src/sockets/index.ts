import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyAccessToken } from '../lib/tokens';
import { prisma } from '../lib/prisma';

async function getAuthorizedConversation(conversationId: string, userId: string) {
  const match = await prisma.match.findUnique({ where: { id: conversationId } });

  if (!match || (match.userOneId !== userId && match.userTwoId !== userId)) {
    return null;
  }

  return match;
}

export function initSocket(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication token required'));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on('typing', async ({ conversationId }: { conversationId: string }) => {
      const match = await getAuthorizedConversation(conversationId, userId);
      if (!match) {
        socket.emit('error', { message: 'Not part of this conversation' });
        return;
      }
      if (match.status !== 'MATCHED') {
        socket.emit('error', { message: 'Conversation is not active' });
        return;
      }

      socket.to(`conversation:${conversationId}`).emit('typing', { userId, conversationId });
    });

    socket.on('join-conversation', async ({ conversationId }: { conversationId: string }) => {
      const match = await getAuthorizedConversation(conversationId, userId);
      if (!match) {
        socket.emit('error', { message: 'Not part of this conversation' });
        return;
      }
      if (match.status !== 'MATCHED') {
        socket.emit('error', { message: 'Conversation is not active' });
        return;
      }

      socket.join(`conversation:${conversationId}`);
    });

    socket.on(
      'send-message',
      async ({
        conversationId,
        content,
        type = 'TEXT',
      }: {
        conversationId: string;
        content: string;
        type?: 'TEXT' | 'IMAGE' | 'VIDEO';
      }) => {
        const match = await getAuthorizedConversation(conversationId, userId);
        if (!match) {
          socket.emit('error', { message: 'Not part of this conversation' });
          return;
        }
        if (match.status !== 'MATCHED') {
          socket.emit('error', { message: 'Conversation is not active' });
          return;
        }

        const message = await prisma.message.create({
          data: {
            matchId: conversationId,
            senderId: userId,
            receiverId: match.userOneId === userId ? match.userTwoId : match.userOneId,
            content,
            type,
          },
        });

        io.to(`conversation:${conversationId}`).emit('new-message', message);
      }
    );

    socket.on('disconnect', () => {
      socket.leave(`user:${userId}`);
    });
  });

  return io;
}

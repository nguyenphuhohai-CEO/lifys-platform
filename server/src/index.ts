import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import matchingRoutes from './routes/matching';
import messagesRoutes from './routes/messages';
import eventsRoutes from './routes/events';
import { apiRateLimiter, authRateLimiter } from './middleware/rateLimit';
import { initSocket } from './sockets';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(apiRateLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRateLimiter, authRoutes);
  app.use('/users', usersRoutes);
  app.use('/', matchingRoutes);
  app.use('/messages', messagesRoutes);
  app.use('/events', eventsRoutes);

  return app;
}

if (require.main === module) {
  const app = createApp();
  const httpServer = createServer(app);
  initSocket(httpServer);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  httpServer.listen(port, () => {
    console.log(`Lifys API server listening on port ${port}`);
  });
}

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './routers';
import { createContext } from './trpc';
import { expireOldRides } from './db';

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());

  // CORS Middleware for Vercel Frontend + Render Backend
  app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint for Render monitoring
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'ridemate-backend', timestamp: new Date().toISOString() });
  });

  // Mount tRPC API
  app.use('/api/trpc', trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }));

  // Serve static client assets if available
  const staticPath = path.resolve(__dirname, 'public');
  const distPublicPath = path.resolve(process.cwd(), 'dist', 'public');
  const clientPath = fs.existsSync(staticPath) ? staticPath : (fs.existsSync(distPublicPath) ? distPublicPath : null);

  if (clientPath) {
    app.use(express.static(clientPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(clientPath, 'index.html'), (err) => {
        if (err) next();
      });
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        service: 'RideMate Backend API',
        status: 'online',
        health: '/api/health',
        trpc: '/api/trpc',
      });
    });
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(port, '0.0.0.0', () => {
    console.log(`[RideMate] Server successfully listening on 0.0.0.0:${port}`);
  });

  // Expire old rides periodically (safely wrapped)
  setInterval(async () => {
    try {
      await expireOldRides();
    } catch (e) {
      console.warn('[expire-rides] Non-fatal background error:', e);
    }
  }, 15 * 60 * 1000);
}

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception (prevented crash):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection (prevented crash):', reason);
});

startServer().catch((err) => {
  console.error('[startServer] Fatal error starting server:', err);
});

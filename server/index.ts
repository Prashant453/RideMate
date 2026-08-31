import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

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
    res.json({ status: 'ok', service: 'ridemate-backend', timestamp: new Date().toISOString() });
  });

  // Mount tRPC API
  app.use('/api/trpc', trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }));

  if (process.env.NODE_ENV !== 'production') {
    // Development: use Vite dev server as middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files if client is colocated
    const staticPath = path.resolve(__dirname, 'public');
    app.use(express.static(staticPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(staticPath, 'index.html'), (err) => {
        if (err) next();
      });
    });
  }

  // Expire old rides every 15 minutes
  setInterval(async () => {
    try {
      const count = await expireOldRides();
      if (count > 0) console.log(`[expire-rides] Expired ${count} ride(s)`);
    } catch (e) {
      console.error('[expire-rides] Error:', e);
    }
  }, 15 * 60 * 1000);

  // Also expire on startup
  expireOldRides().catch(e => console.error('[expire-rides] Startup error:', e));

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`RideMate server running on port ${port}`);
  });
}

startServer().catch(console.error);

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
import webpush from 'web-push';
import { supabaseAdmin } from './supabaseAdmin';

// Configure Web Push
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:prashant65001@gmail.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

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

  app.get('/', (_req, res) => {
    res.json({
      service: 'RideMate Backend API',
      status: 'online',
      health: '/api/health',
      trpc: '/api/trpc',
    });
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(port, () => {
    console.log(`[RideMate] Server successfully listening on port ${port}`);
  });

  // Listen to Supabase Realtime for new notifications and send Web Push
  supabaseAdmin.channel('backend-push-notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
      const notification = payload.new;
      if (!notification.user_id) return;
      
      try {
        const { data: subscriptions } = await supabaseAdmin
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', notification.user_id);
          
        if (subscriptions && subscriptions.length > 0) {
          const payloadString = JSON.stringify({
            title: notification.title,
            body: notification.message,
            url: notification.reference_id ? `/dashboard?ride=${notification.reference_id}` : '/dashboard'
          });

          for (const sub of subscriptions) {
            try {
              await webpush.sendNotification({
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth }
              }, payloadString);
            } catch (err: any) {
              if (err.statusCode === 404 || err.statusCode === 410) {
                // Subscription has expired or is no longer valid
                await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
              } else {
                console.error('[WebPush] Error sending push to endpoint:', err);
              }
            }
          }
        }
      } catch (err) {
        console.error('[WebPush] Error processing realtime notification:', err);
      }
    })
    .subscribe();

  // Listen for new chat messages
  supabaseAdmin.channel('backend-push-chat')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, async (payload) => {
      const chat = payload.new;
      if (!chat.ride_id || !chat.sender_id) return;
      
      try {
        // Find the ride to know driver and passengers
        const { data: ride } = await supabaseAdmin.from('rides').select('driver_id').eq('id', chat.ride_id).single();
        const { data: requests } = await supabaseAdmin.from('ride_requests').select('passenger_id').eq('ride_id', chat.ride_id).eq('status', 'accepted');
        
        if (!ride) return;
        
        const participants = new Set<string>();
        participants.add(ride.driver_id);
        if (requests) {
          requests.forEach(req => participants.add(req.passenger_id));
        }
        
        // Remove sender from notification recipients
        participants.delete(chat.sender_id);
        
        if (participants.size === 0) return;
        
        // Fetch sender details for title
        const { data: sender } = await supabaseAdmin.from('profiles').select('name').eq('id', chat.sender_id).single();
        const senderName = sender?.name || 'Someone';

        for (const userId of Array.from(participants)) {
          const { data: subscriptions } = await supabaseAdmin
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', userId);
            
          if (subscriptions && subscriptions.length > 0) {
            const payloadString = JSON.stringify({
              title: `New message from ${senderName}`,
              body: chat.content,
              url: `/dashboard?ride=${chat.ride_id}`
            });

            for (const sub of subscriptions) {
              try {
                await webpush.sendNotification({
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth }
                }, payloadString);
              } catch (err: any) {
                if (err.statusCode === 404 || err.statusCode === 410) {
                  await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('[WebPush] Error processing realtime chat:', err);
      }
    })
    .subscribe();

  // Expire old rides periodically (safely wrapped)
  setInterval(async () => {
    try {
      const expiredCount = await expireOldRides();
      if (expiredCount && expiredCount > 0) {
        console.log(`[RideMate] Auto-expired ${expiredCount} past rides.`);
      }
    } catch (err) {
      console.error('[RideMate] Error expiring old rides:', err);
    }
    
    // Ride reminders
    try {
      const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const fortyMinutesFromNow = new Date(Date.now() + 40 * 60 * 1000).toISOString();
      
      const { data: upcomingRides } = await supabaseAdmin
        .from('rides')
        .select('id, driver_id, departure_at')
        .eq('status', 'open')
        .gte('departure_at', thirtyMinutesFromNow)
        .lt('departure_at', fortyMinutesFromNow);
        
      if (upcomingRides && upcomingRides.length > 0) {
        for (const ride of upcomingRides) {
          // Check if driver already reminded
          const { data: existingReminders } = await supabaseAdmin
            .from('notifications')
            .select('id')
            .eq('type', 'ride_reminder')
            .eq('reference_id', ride.id);
            
          if (existingReminders && existingReminders.length > 0) continue;
          
          const notificationsToInsert = [];
          
          // Driver reminder
          notificationsToInsert.push({
            user_id: ride.driver_id,
            type: 'ride_reminder',
            title: 'Upcoming Ride',
            message: 'Your ride is departing in 30 minutes.',
            reference_id: ride.id
          });
          
          // Passenger reminders
          const { data: requests } = await supabaseAdmin
            .from('ride_requests')
            .select('passenger_id')
            .eq('ride_id', ride.id)
            .eq('status', 'accepted');
            
          if (requests) {
            for (const req of requests) {
              notificationsToInsert.push({
                user_id: req.passenger_id,
                type: 'ride_reminder',
                title: 'Upcoming Ride',
                message: 'Your requested ride is departing in 30 minutes.',
                reference_id: ride.id
              });
            }
          }
          
          if (notificationsToInsert.length > 0) {
            await supabaseAdmin.from('notifications').insert(notificationsToInsert);
            console.log(`[RideMate] Sent reminders for ride ${ride.id}`);
          }
        }
      }
    } catch (err) {
      console.error('[RideMate] Error sending ride reminders:', err);
    }
  }, 5 * 60 * 1000);
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

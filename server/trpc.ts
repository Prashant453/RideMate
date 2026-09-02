import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import superjson from 'superjson';
import { supabaseAdmin } from './supabaseAdmin';
import { rateLimiter } from './rateLimiter';

interface UserContext {
  id: string; // uuid from auth.users
  email: string;
  role?: string;
}

export interface Context {
  user: UserContext | null;
  clientIp?: string;
}

export async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, clientIp };
  }
  const token = authHeader.slice(7);
  if (!token) return { user: null, clientIp };

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return { user: null, clientIp };

    // Fetch user role from profiles
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return {
      user: {
        id: user.id,
        email: user.email || '',
        role: profile?.role || 'user',
      },
      clientIp,
    };
  } catch {
    return { user: null, clientIp };
  }
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export function createRateLimitMiddleware(name: string, maxRequests: number, windowMs: number) {
  return t.middleware(async ({ ctx, next }) => {
    const key = `${name}:${ctx.user?.id || ctx.clientIp || 'anonymous'}`;
    const result = rateLimiter.check(key, maxRequests, windowMs);
    if (!result.allowed) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Too many requests for ${name}. Please wait ${Math.ceil(result.retryAfterMs / 1000)}s.`,
      });
    }
    return next();
  });
}

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Please login (10001)' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const seatRequestProcedure = protectedProcedure.use(createRateLimitMiddleware('seat-request', 10, 60_000));
export const chatSendProcedure = protectedProcedure.use(createRateLimitMiddleware('chat-send', 30, 60_000));
export const rideCreateProcedure = protectedProcedure.use(createRateLimitMiddleware('ride-create', 10, 600_000));

export const adminProcedure = protectedProcedure.use(createRateLimitMiddleware('admin', 60, 60_000)).use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin privileges required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const superAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'super_admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Super Admin privileges required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

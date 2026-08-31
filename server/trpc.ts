import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { createClient } from '@supabase/supabase-js';
import superjson from 'superjson';

interface UserContext {
  id: string; // uuid from auth.users
  email: string;
}

export interface Context {
  user: UserContext | null;
}

export async function createContext({ req }: CreateExpressContextOptions): Promise<Context> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null };
  }
  const token = authHeader.slice(7);
  if (!token) return { user: null };

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || '',
      process.env.VITE_SUPABASE_ANON_KEY || ''
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { user: null };
    return { user: { id: user.id, email: user.email || '' } };
  } catch {
    return { user: null };
  }
}

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Please login (10001)' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

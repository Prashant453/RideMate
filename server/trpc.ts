import dotenv from 'dotenv';
import path from 'path';
import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { createClient } from '@supabase/supabase-js';
import superjson from 'superjson';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

interface UserContext {
  id: string; // uuid from auth.users
  email: string;
  role?: string;
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
      process.env.VITE_SUPABASE_URL || 'https://jninydpdadnqlgrhtqps.supabase.co',
      process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaW55ZHBkYWRucWxncmh0cXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwOTQ0ODcsImV4cCI6MjEwMzY3MDQ4N30.NwgNM7z6ieDOXJjL9bKC6ASZZX1ApQk6vRjJPXeAqVo'
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return { user: null };

    // Fetch user role from profiles
    const { data: profile } = await supabase
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
    };
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

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
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

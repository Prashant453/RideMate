import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://jninydpdadnqlgrhtqps.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaW55ZHBkYWRucWxncmh0cXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwOTQ0ODcsImV4cCI6MjEwMzY3MDQ4N30.NwgNM7z6ieDOXJjL9bKC6ASZZX1ApQk6vRjJPXeAqVo';

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

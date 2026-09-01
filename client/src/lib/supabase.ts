import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jninydpdadnqlgrhtqps.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaW55ZHBkYWRucWxncmh0cXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwOTQ0ODcsImV4cCI6MjEwMzY3MDQ4N30.NwgNM7z6ieDOXJjL9bKC6ASZZX1ApQk6vRjJPXeAqVo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

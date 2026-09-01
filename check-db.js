import { createClient } from '@supabase/supabase-js';

const url = 'https://jninydpdadnqlgrhtqps.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaW55ZHBkYWRucWxncmh0cXBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODA5NDQ4NywiZXhwIjoyMTAzNjcwNDg3fQ.DY-fRaxFZFALQ_JjHsYcukYMLq_x9yg10AUX-X22hHI';

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('push_subscriptions').select('*').limit(1);
  console.log('Error:', error);
  console.log('Data:', data);
}

check();

import { createClient } from '@supabase/supabase-js';

const CRM_SUPABASE_URL = 'https://nyjhbeqpjfdhhvqvjzyy.supabase.co';
const CRM_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMTAyMTgsImV4cCI6MjEwMTU4NjIxOH0.dng1sTshSzApFQia9YPkGsaBiiwWSJYduX_bAl5asPM';

export const crmSupabase = createClient(CRM_SUPABASE_URL, CRM_SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
  },
});

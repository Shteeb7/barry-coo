const { createClient } = require('@supabase/supabase-js');

// Skip initialization in test mode
let supabase;

if (process.env.NODE_ENV !== 'test') {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing required Supabase environment variables');
  }

  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

module.exports = { supabase };

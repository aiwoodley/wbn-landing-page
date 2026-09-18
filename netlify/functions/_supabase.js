// Shared Supabase admin client for Netlify Functions.
// Uses the SERVICE ROLE key — never expose this key or this file's export
// to any client-side bundle. Functions run server-side only.
const { createClient } = require("@supabase/supabase-js");

let client = null;

function getSupabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  }
  client = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return client;
}

module.exports = { getSupabaseAdmin };

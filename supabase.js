// src/lib/supabase.js
// ─────────────────────────────────────────────────────────────
// Single Supabase client instance shared across the whole app.
//
// Setup:
//   1. npm install @supabase/supabase-js
//   2. Create .env.local in your project root:
//        VITE_SUPABASE_URL=https://your-project.supabase.co
//        VITE_SUPABASE_ANON_KEY=your-anon-key
//   3. Both values are in Supabase Dashboard → Settings → API
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase env vars. " +
    "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local"
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Persist session across page refreshes automatically
    persistSession: true,
    // Detect session from URL hash after magic link / OAuth redirect
    detectSessionInUrl: true,
  },
});

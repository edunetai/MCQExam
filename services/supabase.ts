import { createClient, SupabaseClient } from '@supabase/supabase-js';

// IMPORTANT: Replace with your Supabase project URL and anon key from your project settings.
// These values are intended to be replaced during your self-hosting setup.
// For production deployments, use environment variables provided by your hosting platform.
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

const isConfigured = supabaseUrl !== 'YOUR_SUPABASE_URL' && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

if (!isConfigured) {
    console.warn("Supabase credentials are not set. Please replace 'YOUR_SUPABASE_URL' and 'YOUR_SUPABASE_ANON_KEY' in services/supabase.ts");
}

// The Supabase client is conditionally created to avoid a runtime error with placeholder values.
// The app will now check if the supabase client is null and display a warning if it is.
export const supabase: SupabaseClient | null = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
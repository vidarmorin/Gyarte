import { createClient } from '@supabase/supabase-js'

// Placeholder - replace with your actual values
const SUPABASE_URL = 'https://foxbaubyxqwbwjkeihod.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZveGJhdWJ5eHF3Yndqa2VpaG9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTkzNjYsImV4cCI6MjA3MjM5NTM2Nn0.TCxmgK5DoBPMtpSaP9ofzEiF6dWmGZnJocxRxOUgLEQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

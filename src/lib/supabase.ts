import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amemndrojsaccfhtbsxc.supabase.com';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtZW1uZHJvanNhY2NmaHRic3hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjE2MDEsImV4cCI6MjA4NTA5NzYwMX0.G4RV8_5hF2eVdFA42QQSQGyTIWpjbQlosFnWxMBhp0g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
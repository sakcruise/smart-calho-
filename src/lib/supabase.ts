import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Null until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local. */
export const supabase = url && key ? createClient(url, key) : null

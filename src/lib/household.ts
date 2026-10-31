import { supabase } from './supabase'
import { cacheGet, cacheSet } from './cache'

/** The signed-in account's family id (used to keep each family's photos in their own folder). */
export async function householdId(): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('current_household_id')
  if (error) return cacheGet<string>('household_id') ?? null
  if (data) cacheSet('household_id', data)
  return (data as string | null) ?? null
}

/** Has the app owner switched on "Connect Google Calendar"? */
export async function googleReady(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.rpc('google_ready')
  return data === true
}

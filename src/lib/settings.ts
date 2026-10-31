import { supabase } from './supabase'
import { cacheGet, cacheSet } from './cache'

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const cached = cacheGet<T>(`setting:${key}`)
  if (!supabase) return cached ?? fallback
  const { data, error } = await supabase.from('settings').select('value').eq('key', key).maybeSingle()
  if (error) return cached ?? fallback // offline: last known value
  if (data) cacheSet(`setting:${key}`, data.value)
  return data ? (data.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  if (!supabase) return
  await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'household_id,key' })
}

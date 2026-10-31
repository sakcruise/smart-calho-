import { supabase } from './supabase'

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  if (!supabase) return fallback
  const { data } = await supabase.from('settings').select('value').eq('key', key).maybeSingle()
  return data ? (data.value as T) : fallback
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  if (!supabase) return
  await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() })
}

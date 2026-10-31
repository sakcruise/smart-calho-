import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { cacheGet, cacheSet } from '../../lib/cache'
import type { CalendarEvent } from '../../lib/types'

/**
 * Events that could touch [from, to): one-off events overlapping the range plus every repeating local event
 * that started before its end. Live through Realtime.
 */
export function useEvents(from: Date, to: Date) {
  const fromIso = from.toISOString(), toIso = to.toISOString()
  const [events, setEvents] = useState<CalendarEvent[]>(() => cacheGet<CalendarEvent[]>(`events:${fromIso}`) ?? [])

  const load = useCallback(async () => {
    if (!supabase) return
    // Pad a day either side so all-day events stored as UTC dates are never cut off
    const f = new Date(new Date(fromIso).getTime() - 86400000).toISOString()
    const t = new Date(new Date(toIso).getTime() + 86400000).toISOString()
    const [{ data: oneOff, error: e1 }, { data: repeating, error: e2 }] = await Promise.all([
      supabase.from('events').select('*').is('recurrence_rule', null).lt('starts_at', t).gt('ends_at', f).order('starts_at').limit(2000),
      supabase.from('events').select('*').not('recurrence_rule', 'is', null).lt('starts_at', t),
    ])
    if (e1 || e2) return // offline: keep what we have
    const all = [...((oneOff as CalendarEvent[]) ?? []), ...((repeating as CalendarEvent[]) ?? [])]
    setEvents(all); cacheSet(`events:${fromIso}`, all)
  }, [fromIso, toIso])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    void load()
    // A calendar sync changes hundreds of rows at once; reload once when they settle, not per row
    let timer: ReturnType<typeof setTimeout> | undefined
    const soon = () => { clearTimeout(timer); timer = setTimeout(() => void load(), 600) }
    const channel = client
      .channel(`events:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, soon)
      .subscribe()
    return () => { clearTimeout(timer); void client.removeChannel(channel) }
  }, [load])

  return events
}

/** Ask the server to re-read connected calendars (all, or one). */
export async function syncCalendars(sourceId?: string): Promise<{ results?: { name: string; events?: number; error?: string }[]; error?: string }> {
  if (!supabase) return { error: 'Not connected' }
  const { data, error } = await supabase.functions.invoke('sync-calendars', { body: sourceId ? { source_id: sourceId } : {} })
  if (error) return { error: error.message }
  return data
}

/** Sync only if no screen has synced in the last 10 minutes (the wall and phones all call this). */
export async function syncCalendarsIfStale() {
  if (!supabase) return
  const { data, error } = await supabase.from('calendar_sources').select('last_synced_at')
  if (error || !data?.length) return
  const oldest = Math.min(...data.map((r: { last_synced_at: string | null }) => (r.last_synced_at ? Date.parse(r.last_synced_at) : 0)))
  if (Date.now() - oldest > 10 * 60 * 1000) await syncCalendars()
}

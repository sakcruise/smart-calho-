import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../lib/useTable'
import type { Reminder } from '../../lib/types'
import { fireAt, isDue, nextOccurrence } from './logic'

export function useReminders() {
  const { rows } = useTable<Reminder>('reminders', 'due_at')
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(id) }, [])

  const active = rows.filter((r) => !r.dismissed_at)
  const due = active.filter((r) => isDue(r, now))
  const upcoming = active.filter((r) => !isDue(r, now)).sort((a, b) => fireAt(a).getTime() - fireAt(b).getTime())

  async function snooze(r: Reminder, minutes = 10) {
    await supabase?.from('reminders').update({ snoozed_until: new Date(Date.now() + minutes * 60000).toISOString() }).eq('id', r.id)
  }

  /** Done: a one-off is dismissed; a recurring one rolls to its next occurrence. */
  async function dismiss(r: Reminder) {
    if (!supabase) return
    const next = r.recurrence_rule && r.recurrence_rule !== 'none' ? nextOccurrence(r.due_at, r.recurrence_rule) : null
    if (next) await supabase.from('reminders').update({ due_at: next.toISOString(), snoozed_until: null }).eq('id', r.id)
    else await supabase.from('reminders').update({ dismissed_at: new Date().toISOString() }).eq('id', r.id)
  }

  async function remove(r: Reminder) {
    await supabase?.from('reminders').delete().eq('id', r.id)
  }

  return { due, upcoming, snooze, dismiss, remove }
}

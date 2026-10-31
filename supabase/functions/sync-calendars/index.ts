// Fetch each connected calendar's private iCal link and replace its events in the window
// 31 days back to 180 days ahead. Callers must be signed in and in the household.
import ICAL from 'npm:ical.js@2.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { expandIcs } from './ics.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const MAX_BYTES = 8 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const auth = req.headers.get('Authorization') ?? ''

  // Only household members may trigger a sync
  const asUser = createClient(url, anon, { global: { headers: { Authorization: auth } } })
  const { data: member, error: memberErr } = await asUser.rpc('is_household_member')
  if (memberErr || member !== true) return json({ error: 'Not allowed' }, 403)

  const admin = createClient(url, service)
  let body: { source_id?: string } = {}
  try { body = await req.json() } catch { /* sync all */ }

  let q = admin.from('calendar_sources').select('*')
  if (body.source_id) q = q.eq('id', body.source_id)
  const { data: sources, error } = await q
  if (error) return json({ error: error.message }, 500)

  const from = new Date(Date.now() - 31 * 86400000)
  const to = new Date(Date.now() + 180 * 86400000)
  const results: { id: string; name: string; events?: number; error?: string }[] = []

  for (const s of sources ?? []) {
    try {
      const link = String(s.url).trim().replace(/^webcal:\/\//i, 'https://')
      if (!/^https:\/\//i.test(link)) throw new Error('The link must start with https:// or webcal://')
      const res = await fetch(link, { headers: { Accept: 'text/calendar' } })
      if (!res.ok) throw new Error(`The calendar link answered ${res.status}. Check it is the private (secret) iCal address.`)
      const text = await res.text()
      if (text.length > MAX_BYTES) throw new Error('That calendar is too large to sync.')
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error("That link didn't return a calendar. Use the iCal (.ics) address.")

      const runStart = new Date().toISOString()
      const occ = expandIcs(ICAL, text, from, to)
      const seen = new Set<string>()
      const rows = []
      for (const o of occ) {
        const external_id = `${s.id}:${o.uid}:${o.start}`
        if (seen.has(external_id)) continue
        seen.add(external_id)
        rows.push({
          title: o.title.slice(0, 300), starts_at: o.start, ends_at: o.end, all_day: o.allDay,
          member_ids: s.member_ids ?? [], location: o.location?.slice(0, 300) ?? null,
          source: s.provider === 'microsoft' ? 'microsoft' : 'google', external_id, source_id: s.id, synced_at: runStart,
        })
      }

      // Update in place (safe when two screens sync at the same moment), then drop events that left the feed
      for (let i = 0; i < rows.length; i += 500) {
        const { error: upErr } = await admin.from('events').upsert(rows.slice(i, i + 500), { onConflict: 'source,external_id' })
        if (upErr) throw new Error(upErr.message)
      }
      // Events this run didn't see are gone. The 2-minute margin stops an overlapping sync (seconds apart) wiping a fresh one.
      const staleBefore = new Date(Date.parse(runStart) - 2 * 60 * 1000).toISOString()
      const { error: delErr } = await admin.from('events').delete().eq('source_id', s.id).or(`synced_at.is.null,synced_at.lt.${staleBefore}`)
      if (delErr) throw new Error(delErr.message)
      await admin.from('calendar_sources').update({ last_synced_at: new Date().toISOString(), last_error: null, event_count: rows.length }).eq('id', s.id)
      results.push({ id: s.id, name: s.name, events: rows.length })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      await admin.from('calendar_sources').update({ last_error: message }).eq('id', s.id)
      results.push({ id: s.id, name: s.name, error: message })
    }
  }
  return json({ results })
})

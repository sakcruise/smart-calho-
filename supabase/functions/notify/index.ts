// Sends phone notifications: due reminders and tasks waiting for a parent's approval.
// Called every minute by pg_cron (x-cron-secret header). A signed-in household member can also
// POST {"test": true} to get a test notification on their own phones.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

interface Sub { household_id: string; endpoint: string; user_id: string | null; member_id: string | null; p256dh: string; auth: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: secretRows } = await admin.from('app_secrets').select('name, value')
  const secret = Object.fromEntries((secretRows ?? []).map((r: { name: string; value: string }) => [r.name, r.value]))
  webpush.setVapidDetails(secret.vapid_subject, secret.vapid_public, secret.vapid_private)

  const { data: subs } = await admin.from('push_subscriptions').select('*')
  const all = (subs ?? []) as Sub[]
  let sent = 0
  const gone: string[] = []
  const send = async (targets: Sub[], payload: Record<string, unknown>) => {
    await Promise.all(targets.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 })
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) gone.push(s.endpoint) // phone unsubscribed or app removed
      }
    }))
  }

  // Test from the Parents screen
  let body: { test?: boolean } = {}
  try { body = await req.json() } catch { /* cron sends {} */ }
  if (req.headers.get('x-cron-secret') !== secret.cron_secret) {
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: member } = await asUser.rpc('is_household_member')
    const { data: { user } } = await asUser.auth.getUser()
    if (member !== true || !user || !body.test) return json({ error: 'Not allowed' }, 403)
    await send(all.filter((s) => s.user_id === user.id), { title: 'Notifications are on', body: "You'll get reminders and approvals here.", tag: 'test' })
    if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone)
    return json({ sent })
  }

  const now = Date.now()
  const { data: members } = await admin.from('family_members').select('id, name')
  const family = (hh: string) => all.filter((s) => s.household_id === hh)
  const nameOf = (id: string | null) => (members ?? []).find((m: { id: string }) => m.id === id)?.name

  // Reminders that fell due in the last 15 minutes and haven't been pushed for this occurrence
  const { data: reminders } = await admin.from('reminders').select('*').is('dismissed_at', null).lte('due_at', new Date(now).toISOString())
  for (const r of reminders ?? []) {
    const fire = Math.max(Date.parse(r.due_at), r.snoozed_until ? Date.parse(r.snoozed_until) : 0)
    if (fire > now || fire < now - 15 * 60000) continue
    if (r.pushed_at && Date.parse(r.pushed_at) >= fire) continue
    const theirs = family(r.household_id)
    const mine = r.member_id ? theirs.filter((s) => s.member_id === r.member_id) : []
    const who = nameOf(r.member_id)
    await send(mine.length ? mine : theirs, { title: r.text, body: who ? `Reminder for ${who}` : 'Family reminder', tag: `reminder-${r.id}`, url: '/' })
    await admin.from('reminders').update({ pushed_at: new Date(now).toISOString() }).eq('id', r.id)
  }

  // Ticks waiting for a parent
  const { data: waiting } = await admin.from('task_completions').select('id, task_id, member_id, completed_at, household_id')
    .eq('status', 'awaiting_approval').is('notified_at', null).gte('completed_at', new Date(now - 86400000).toISOString())
  if (waiting?.length) {
    const { data: tasks } = await admin.from('tasks').select('id, title').in('id', waiting.map((w) => w.task_id))
    for (const w of waiting) {
      const title = (tasks ?? []).find((t: { id: string }) => t.id === w.task_id)?.title ?? 'a task'
      await send(family(w.household_id), { title: `${nameOf(w.member_id) ?? 'Someone'} finished: ${title}`, body: 'Tap to approve their stars.', tag: `approve-${w.id}`, url: '/?tab=parents' })
      await admin.from('task_completions').update({ notified_at: new Date(now).toISOString() }).eq('id', w.id)
    }
  }

  // Doorbell and other Home Box events from the last 2 minutes
  const { data: homeEvents } = await admin.from('home_events').select('id, household_id, title, camera')
    .eq('kind', 'doorbell').is('notified_at', null).gte('created_at', new Date(now - 120000).toISOString())
  for (const e of homeEvents ?? []) {
    await admin.from('home_events').update({ notified_at: new Date(now).toISOString() }).eq('id', e.id)
    await send(family(e.household_id), { title: e.title, body: e.camera ? `${e.camera} camera` : 'Front door', tag: `home-${e.id}`, url: '/' })
  }

  if (gone.length) await admin.from('push_subscriptions').delete().in('endpoint', gone)
  return json({ sent, removed: gone.length })
})

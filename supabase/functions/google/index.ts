// Two-way Google Calendar: connect an account (OAuth), then create, edit or delete events in it.
// GET  ?code&state             Google's redirect after the parent approves access
// POST {action:'auth_url', source_id, return_to}
// POST {action:'create'|'update'|'delete', source_id, event?, external_id?}
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const REDIRECT = `${SUPABASE_URL}/functions/v1/google`
const SCOPE = 'https://www.googleapis.com/auth/calendar.events openid email'
const TZ = 'Europe/London'

/** The calendar id is inside Google's secret iCal address: /calendar/ical/<id>/private-…/basic.ics */
function calendarIdFrom(url: string): string {
  const m = url.match(/\/calendar\/ical\/([^/]+)\//)
  return m ? decodeURIComponent(m[1]) : 'primary'
}

/** Google event id from our external_id "<source>:<uid>:<start>" where uid is "<eventId>@google.com". */
function eventIdFrom(externalId: string): string {
  const uid = externalId.slice(37).replace(/:\d{4}-\d{2}-\d{2}T[\d:.]+Z$/, '') // drop "<uuid>:" and ":<ISO start>"
  return uid.split('@')[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: secretRows } = await admin.from('app_secrets').select('name, value').in('name', ['google_client_id', 'google_client_secret'])
  const secret = Object.fromEntries((secretRows ?? []).map((r: { name: string; value: string }) => [r.name, r.value]))
  if (!secret.google_client_id || !secret.google_client_secret) return json({ error: 'Google is not set up yet. Add the client ID and secret in Parents.' }, 400)

  // ---- Google redirects back here after the parent approves ----
  if (req.method === 'GET') {
    const u = new URL(req.url)
    const state = u.searchParams.get('state') ?? ''
    const { data: st } = await admin.from('google_oauth_states').select('*').eq('state', state).maybeSingle()
    if (!st || Date.now() - Date.parse(st.created_at) > 15 * 60000) return new Response('This link has expired. Start again from the app.', { status: 400 })
    await admin.from('google_oauth_states').delete().eq('state', state)
    const back = new URL(st.return_to)
    back.searchParams.set('tab', 'parents')
    const code = u.searchParams.get('code')
    if (!code) { back.searchParams.set('google', 'cancelled'); return Response.redirect(back.toString(), 302) }

    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: secret.google_client_id, client_secret: secret.google_client_secret, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
    }).then((r) => r.json())
    if (!tok.refresh_token) { back.searchParams.set('google', 'failed'); return Response.redirect(back.toString(), 302) }
    let email: string | null = null
    try { email = JSON.parse(atob(tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email ?? null } catch { /* optional */ }
    await admin.from('google_accounts').upsert({ source_id: st.source_id, refresh_token: tok.refresh_token, google_email: email })
    await admin.from('calendar_sources').update({ can_write: true, google_email: email }).eq('id', st.source_id)
    back.searchParams.set('google', 'connected')
    return Response.redirect(back.toString(), 302)
  }

  // ---- App calls: signed-in household members only ----
  const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: member } = await asUser.rpc('is_household_member')
  if (member !== true) return json({ error: 'Not allowed' }, 403)

  const body = await req.json().catch(() => ({}))
  const { data: source } = await admin.from('calendar_sources').select('*').eq('id', body.source_id ?? '').maybeSingle()
  if (!source) return json({ error: 'Unknown calendar' }, 404)

  if (body.action === 'auth_url') {
    const state = crypto.randomUUID()
    await admin.from('google_oauth_states').insert({ state, source_id: source.id, return_to: String(body.return_to || '').slice(0, 500) })
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.search = new URLSearchParams({
      client_id: secret.google_client_id, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPE,
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
    }).toString()
    return json({ url: url.toString() })
  }

  const { data: acct } = await admin.from('google_accounts').select('refresh_token').eq('source_id', source.id).maybeSingle()
  if (!acct) return json({ error: 'Connect the Google account for this calendar first.' }, 400)
  const access = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: acct.refresh_token, client_id: secret.google_client_id, client_secret: secret.google_client_secret, grant_type: 'refresh_token' }),
  }).then((r) => r.json())
  if (!access.access_token) {
    await admin.from('calendar_sources').update({ can_write: false }).eq('id', source.id)
    return json({ error: 'Google access has expired. Connect the account again.' }, 401)
  }
  const api = (path: string, init: RequestInit = {}) => fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarIdFrom(source.url))}/events${path}`, {
    ...init, headers: { Authorization: `Bearer ${access.access_token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

  // Our event shape → Google's
  const toGoogle = (e: { title: string; location?: string | null; all_day: boolean; date?: string; start?: string; end?: string; repeat?: string | null }) => {
    const g: Record<string, unknown> = { summary: e.title, location: e.location ?? undefined }
    if (e.all_day) {
      const [y, m, d] = String(e.date).split('-').map(Number)
      const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
      g.start = { date: e.date }; g.end = { date: next }
    } else {
      g.start = { dateTime: e.start, timeZone: TZ }; g.end = { dateTime: e.end, timeZone: TZ }
    }
    const rule = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' }[e.repeat ?? ''] 
    if (rule) g.recurrence = [`RRULE:FREQ=${rule}`]
    return g
  }

  let res: Response
  if (body.action === 'create') {
    res = await api('', { method: 'POST', body: JSON.stringify(toGoogle(body.event)) })
  } else if (body.action === 'update' || body.action === 'delete') {
    const id = eventIdFrom(String(body.external_id ?? ''))
    const current = await api(`/${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null)
    if (!current) return json({ error: "That event isn't in Google any more." }, 404)
    if (current.recurrence) return json({ error: 'This is a repeating event. Change it in Google Calendar.' }, 400)
    res = body.action === 'delete'
      ? await api(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
      : await api(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(toGoogle(body.event)) })
  } else return json({ error: 'Unknown action' }, 400)

  if (!res.ok) {
    const detail = await res.text()
    return json({ error: `Google said no (${res.status}). ${detail.slice(0, 200)}` }, 502)
  }
  return json({ ok: true })
})

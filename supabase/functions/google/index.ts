// Two-way Google Calendar.
// One-button flow: auth_url (no source) → Google → callback stores a login → list_calendars → add_calendars.
// Older flow: auth_url with source_id upgrades an iCal-linked calendar to writable.
// create / update / delete write events to Google; the app then re-syncs that calendar.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { accessToken, calendarIdOf, googleSecrets, refreshTokenFor } from './google_api.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const REDIRECT = `${SUPABASE_URL}/functions/v1/google`
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events openid email'
const TZ = 'Europe/London'

/** Google event id from our external_id "<source uuid>:<id or uid>:<ISO start>". */
function eventIdFrom(externalId: string): string {
  const uid = externalId.slice(37).replace(/:\d{4}-\d{2}-\d{2}T[\d:.]+Z$/, '')
  return uid.split('@')[0]
}

function emailFromIdToken(idToken?: string): string | null {
  try { return JSON.parse(atob(String(idToken).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email ?? null } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const g = await googleSecrets(admin)
  if (!g.id || !g.secret) return json({ error: 'Google sign-in is not set up for this app yet.' }, 400)

  // ---- Google redirects back here ----
  if (req.method === 'GET') {
    const u = new URL(req.url)
    const state = u.searchParams.get('state') ?? ''
    const { data: oneButton } = await admin.from('google_connect_states').select('*').eq('state', state).maybeSingle()
    const { data: perSource } = oneButton ? { data: null } : await admin.from('google_oauth_states').select('*').eq('state', state).maybeSingle()
    const st = oneButton ?? perSource
    if (!st || Date.now() - Date.parse(st.created_at) > 15 * 60000) return new Response('This link has expired. Start again from the app.', { status: 400 })
    await admin.from(oneButton ? 'google_connect_states' : 'google_oauth_states').delete().eq('state', state)

    const back = new URL(st.return_to)
    back.searchParams.set('tab', 'parents')
    const code = u.searchParams.get('code')
    if (!code) { back.searchParams.set('google', 'cancelled'); return Response.redirect(back.toString(), 302) }
    const tok = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: g.id, client_secret: g.secret, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
    }).then((r) => r.json())
    if (!tok.refresh_token) {
      console.error('google token exchange failed', JSON.stringify({ error: tok.error, desc: tok.error_description, has_access: !!tok.access_token, scope: tok.scope }))
      back.searchParams.set('google', 'failed')
      back.searchParams.set('reason', String(tok.error_description || tok.error || 'no refresh token').slice(0, 120))
      return Response.redirect(back.toString(), 302)
    }
    const granted = String(tok.scope ?? '')
    if (!granted.includes('calendar.events') || !granted.includes('calendar.readonly')) {
      back.searchParams.set('google', 'noscope'); return Response.redirect(back.toString(), 302)
    }
    const email = emailFromIdToken(tok.id_token)

    if (oneButton) {
      const { data: login, error: loginErr } = await admin.from('google_logins')
        .upsert({ google_email: email, refresh_token: tok.refresh_token }, { onConflict: 'google_email' }).select('id').single()
      if (loginErr || !login) {
        console.error('google login save failed', loginErr?.message)
        back.searchParams.set('google', 'failed'); back.searchParams.set('reason', String(loginErr?.message ?? 'save failed').slice(0, 120))
        return Response.redirect(back.toString(), 302)
      }
      back.searchParams.set('google', 'connected')
      back.searchParams.set('login', login.id)
    } else {
      await admin.from('google_accounts').upsert({ source_id: st.source_id, refresh_token: tok.refresh_token, google_email: email })
      await admin.from('calendar_sources').update({ can_write: true, google_email: email }).eq('id', st.source_id)
      back.searchParams.set('google', 'upgraded')
    }
    return Response.redirect(back.toString(), 302)
  }

  // ---- App calls: signed-in household members only ----
  const asUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: member } = await asUser.rpc('is_household_member')
  if (member !== true) return json({ error: 'Not allowed' }, 403)
  const body = await req.json().catch(() => ({}))
  const returnTo = String(body.return_to || '').slice(0, 500)

  const authUrl = (state: string) => {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.search = new URLSearchParams({
      client_id: g.id!, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPE,
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
    }).toString()
    return url.toString()
  }

  if (body.action === 'auth_url' && !body.source_id) {
    const state = crypto.randomUUID()
    await admin.from('google_connect_states').insert({ state, return_to: returnTo })
    return json({ url: authUrl(state) })
  }

  if (body.action === 'list_calendars' || body.action === 'add_calendars') {
    const { data: login } = await admin.from('google_logins').select('*').eq('id', body.login_id ?? '').maybeSingle()
    if (!login) return json({ error: 'That Google account isn\'t connected. Try again.' }, 404)
    const token = await accessToken(g.id, g.secret, login.refresh_token)
    if (!token) return json({ error: 'Google access was removed. Connect again.' }, 401)
    const list = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
    const cals = (list.items ?? []).map((c: Record<string, unknown>) => ({
      id: c.id, name: c.summaryOverride ?? c.summary, primary: !!c.primary, colour: c.backgroundColor,
      writable: c.accessRole === 'owner' || c.accessRole === 'writer',
    }))
    if (body.action === 'list_calendars') return json({ email: login.google_email, calendars: cals })

    const wanted: { id: string; name?: string; member_ids?: string[] }[] = Array.isArray(body.calendars) ? body.calendars : []
    const { data: existing } = await admin.from('calendar_sources').select('google_calendar_id').eq('google_login_id', login.id)
    const have = new Set((existing ?? []).map((e: { google_calendar_id: string }) => e.google_calendar_id))
    const rows = wanted.filter((w) => !have.has(w.id)).map((w) => {
      const c = cals.find((x: { id: string }) => x.id === w.id)
      return {
        name: String(w.name || c?.name || 'Google calendar').slice(0, 100), provider: 'google', url: `google:${w.id}`,
        member_ids: w.member_ids ?? [], google_login_id: login.id, google_calendar_id: w.id,
        can_write: !!c?.writable, google_email: login.google_email,
      }
    })
    if (rows.length) {
      const { error } = await admin.from('calendar_sources').insert(rows)
      if (error) return json({ error: error.message }, 500)
    }
    return json({ ok: true, added: rows.length })
  }

  // Everything below works on one calendar
  const { data: source } = await admin.from('calendar_sources').select('*').eq('id', body.source_id ?? '').maybeSingle()
  if (!source) return json({ error: 'Unknown calendar' }, 404)

  if (body.action === 'auth_url') {
    const state = crypto.randomUUID()
    await admin.from('google_oauth_states').insert({ state, source_id: source.id, return_to: returnTo })
    return json({ url: authUrl(state) })
  }

  const refresh = await refreshTokenFor(admin, source)
  if (!refresh) return json({ error: 'Connect the Google account for this calendar first.' }, 400)
  const token = await accessToken(g.id, g.secret, refresh)
  if (!token) {
    await admin.from('calendar_sources').update({ can_write: false }).eq('id', source.id)
    return json({ error: 'Google access has expired. Connect the account again.' }, 401)
  }
  const api = (path: string, init: RequestInit = {}) => fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarIdOf(source))}/events${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })

  const toGoogle = (e: { title: string; location?: string | null; all_day: boolean; date?: string; start?: string; end?: string; repeat?: string | null }) => {
    const ev: Record<string, unknown> = { summary: e.title, location: e.location ?? undefined }
    if (e.all_day) {
      const [y, m, d] = String(e.date).split('-').map(Number)
      ev.start = { date: e.date }; ev.end = { date: new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10) }
    } else {
      ev.start = { dateTime: e.start, timeZone: TZ }; ev.end = { dateTime: e.end, timeZone: TZ }
    }
    const rule = ({ daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' } as Record<string, string>)[e.repeat ?? '']
    if (rule) ev.recurrence = [`RRULE:FREQ=${rule}`]
    return ev
  }

  let res: Response
  if (body.action === 'create') {
    res = await api('', { method: 'POST', body: JSON.stringify(toGoogle(body.event)) })
  } else if (body.action === 'update' || body.action === 'delete') {
    const id = eventIdFrom(String(body.external_id ?? ''))
    const current = await api(`/${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null)
    if (!current || current.status === 'cancelled') {
      if (body.action === 'delete') return json({ ok: true, note: 'already gone' })
      return json({ error: "That event isn't in Google any more." }, 404)
    }
    if (current.recurrence) return json({ error: 'This is a repeating event. Change it in Google Calendar.' }, 400)
    res = body.action === 'delete'
      ? await api(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
      : await api(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(toGoogle(body.event)) })
  } else return json({ error: 'Unknown action' }, 400)

  if (body.action === 'delete' && (res.status === 404 || res.status === 410)) return json({ ok: true, note: 'already gone' })
  if (!res.ok) {
    const detail = await res.text()
    console.error('google write failed', body.action, res.status, detail.slice(0, 500))
    if (res.status === 403 && body.action === 'delete') return json({ error: "Google won't let this calendar delete that event — it was probably sent to you by someone else. Remove it in Google Calendar." }, 502)
    return json({ error: `Google said no (${res.status}). ${detail.slice(0, 200)}` }, 502)
  }
  return json({ ok: true })
})

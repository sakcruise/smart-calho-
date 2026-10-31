import { supabase } from '../../lib/supabase'
import { syncCalendars } from './useEvents'

export const GOOGLE_REDIRECT_URI = 'https://kmuryknypcnhludyjaoi.supabase.co/functions/v1/google'

export interface GoogleEventInput {
  title: string
  location: string | null
  all_day: boolean
  date: string
  start?: string
  end?: string
  repeat?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function call(body: Record<string, unknown>): Promise<{ ok?: boolean; url?: string; error?: string; [k: string]: any }> {
  if (!supabase) return { error: 'Not connected' }
  const { data, error } = await supabase.functions.invoke('google', { body })
  if (error) {
    // Pull the readable message out of an error response
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) return { error: j.error } } catch { /* fall through */ }
    return { error: error.message }
  }
  return data
}

export interface GoogleCalendarChoice { id: string; name: string; primary: boolean; colour?: string; writable: boolean }

/** One button: sign in to Google, allow, come back to Parents with ?google=connected&login=<id>. */
export async function connectGoogleAccount() {
  const r = await call({ action: 'auth_url', return_to: window.location.origin + '/' })
  if (r.url) window.location.href = r.url
  return r
}

export async function listGoogleCalendars(loginId: string): Promise<{ email?: string; calendars?: GoogleCalendarChoice[]; error?: string }> {
  return call({ action: 'list_calendars', login_id: loginId })
}

/** Show the ticked calendars on the wall, then load their events. */
export async function addGoogleCalendars(loginId: string, calendars: { id: string; name: string; member_ids: string[] }[]) {
  const r = await call({ action: 'add_calendars', login_id: loginId, calendars })
  if (!r.error) await syncCalendars()
  return r
}

/** Send the parent to Google to allow this calendar to be written to; they come back to Parents. */
export async function connectGoogle(sourceId: string) {
  const r = await call({ action: 'auth_url', source_id: sourceId, return_to: window.location.origin + '/' })
  if (r.url) window.location.href = r.url
  return r
}

/** Create, change or delete an event in Google, then refresh that calendar so the wall shows it. */
export async function writeGoogle(action: 'create' | 'update' | 'delete', sourceId: string, event?: GoogleEventInput, externalId?: string) {
  const r = await call({ action, source_id: sourceId, event, external_id: externalId })
  if (!r.error) await syncCalendars(sourceId)
  return r
}

export async function saveGoogleCredentials(clientId: string, clientSecret: string) {
  if (!supabase) return false
  const { data } = await supabase.rpc('set_google_credentials', { client_id: clientId, client_secret: clientSecret })
  return data === true
}

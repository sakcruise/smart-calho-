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

async function call(body: Record<string, unknown>): Promise<{ ok?: boolean; url?: string; error?: string }> {
  if (!supabase) return { error: 'Not connected' }
  const { data, error } = await supabase.functions.invoke('google', { body })
  if (error) {
    // Pull the readable message out of an error response
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) return { error: j.error } } catch { /* fall through */ }
    return { error: error.message }
  }
  return data
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

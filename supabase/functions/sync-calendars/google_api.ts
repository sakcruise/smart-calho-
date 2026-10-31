// Shared Google helpers (copied into each function that needs them).
// deno-lint-ignore-file no-explicit-any
export async function googleSecrets(admin: any): Promise<{ id?: string; secret?: string }> {
  const { data } = await admin.from('app_secrets').select('name, value').in('name', ['google_client_id', 'google_client_secret'])
  const m = Object.fromEntries((data ?? []).map((r: { name: string; value: string }) => [r.name, r.value]))
  return { id: m.google_client_id, secret: m.google_client_secret }
}

/** Swap a refresh token for a short-lived access token; null if Google has revoked it. */
export async function accessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string | null> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
  }).then((x) => x.json())
  return r.access_token ?? null
}

/** The refresh token for a calendar: from its Google login (one-button flow) or the older per-calendar link. */
export async function refreshTokenFor(admin: any, source: any): Promise<string | null> {
  if (source.google_login_id) {
    const { data } = await admin.from('google_logins').select('refresh_token').eq('id', source.google_login_id).maybeSingle()
    return data?.refresh_token ?? null
  }
  const { data } = await admin.from('google_accounts').select('refresh_token').eq('source_id', source.id).maybeSingle()
  return data?.refresh_token ?? null
}

/** Calendar id: stored for one-button calendars, otherwise read from the secret iCal address. */
export function calendarIdOf(source: any): string {
  if (source.google_calendar_id) return source.google_calendar_id
  const m = String(source.url).match(/\/calendar\/ical\/([^/]+)\//)
  return m ? decodeURIComponent(m[1]) : 'primary'
}

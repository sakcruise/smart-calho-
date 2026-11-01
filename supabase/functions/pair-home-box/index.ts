// A Home Box swaps the pairing code shown in Parents for its own voice key.
// POST { code } → { token, family } . Codes work once and expire after 30 minutes.
// POST { token, ready: true, ok, detail } → the box reports it finished setting up; the family sees it in the app.
// POST { event: { kind, title, camera, image } } with header x-voice-token → doorbell ring etc.; pops up on the wall.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const body = await req.json().catch(() => ({})) as { code?: string; name?: string; token?: string; ready?: boolean; ok?: boolean; detail?: string; event?: Record<string, unknown> }

  const headerToken = req.headers.get('x-voice-token') ?? ''
  if (body.event && headerToken.startsWith('fam_')) {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: tok } = await admin.from('voice_tokens').select('household_id').eq('token_hash', await sha256(headerToken)).maybeSingle()
    if (!tok) return json({ error: 'Unknown Home Box' }, 401)
    const e = body.event
    const kind = ['doorbell', 'motion', 'person'].includes(String(e.kind)) ? String(e.kind) : 'doorbell'
    // One pop-up per ring: ignore repeats from the same camera within 20 seconds
    const { data: recent } = await admin.from('home_events').select('id').eq('household_id', tok.household_id).eq('kind', kind)
      .gt('created_at', new Date(Date.now() - 20000).toISOString()).limit(1)
    if (recent?.length) return json({ ok: true, duplicate: true })
    await admin.from('home_events').insert({
      household_id: tok.household_id, kind,
      title: String(e.title ?? (kind === 'doorbell' ? "Someone's at the door" : 'Movement outside')).slice(0, 120),
      camera: e.camera ? String(e.camera).slice(0, 120) : null,
      image_path: typeof e.image === 'string' && e.image.startsWith('/api/') ? e.image.slice(0, 500) : null,
    })
    // Tell the phones now rather than at the next minute
    const { data: secret } = await admin.from('app_secrets').select('value').eq('name', 'cron_secret').maybeSingle()
    if (secret?.value) {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/notify`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret.value }, body: '{}' }).catch(() => undefined)
    }
    return json({ ok: true })
  }

  if (body.ready && typeof body.token === 'string' && body.token.startsWith('fam_')) {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: tok } = await admin.from('voice_tokens').select('id, household_id').eq('token_hash', await sha256(body.token)).maybeSingle()
    if (!tok) return json({ error: 'Unknown Home Box' }, 401)
    const ok = body.ok !== false
    const reply = ok
      ? 'Your Home Box is set up and connected. Try saying "what\'s on tomorrow?"'
      : `Your Home Box is connected, but something needs a look: ${String(body.detail ?? 'unknown problem').slice(0, 160)}`
    await admin.from('voice_log').insert({ household_id: tok.household_id, heard: null, reply, intent: 'home_box_ready', ok })
    await admin.from('voice_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tok.id)
    return json({ ok: true })
  }
  const code = String(body.code ?? '').trim().toUpperCase().replace(/\s+/g, '').replace(/^(\w{4})(\w{4})$/, '$1-$2')
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return json({ error: 'That pairing code looks wrong. It is 8 letters and numbers, like ABCD-1234.' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // Claim the code atomically so it can only be used once
  const { data: pairing } = await admin.from('home_pairings').update({ used_at: new Date().toISOString() })
    .eq('code', code).is('used_at', null).gt('expires_at', new Date().toISOString()).select('household_id').maybeSingle()
  if (!pairing) return json({ error: 'That pairing code has expired or was already used. Make a new one in Parents → Home Box.' }, 404)

  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = 'fam_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  const label = String(body.name ?? 'Home Box').slice(0, 60) || 'Home Box'
  const { error } = await admin.from('voice_tokens').insert({ household_id: pairing.household_id, token_hash: await sha256(token), label })
  if (error) return json({ error: 'Could not pair right now. Try again.' }, 500)
  const { data: hh } = await admin.from('households').select('name').eq('id', pairing.household_id).maybeSingle()
  return json({ token, family: hh?.name ?? 'Your family' })
})

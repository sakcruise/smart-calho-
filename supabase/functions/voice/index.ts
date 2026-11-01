// Voice commands from Home Assistant. HA hears a sentence, picks the intent, and POSTs here:
//   headers: x-voice-token: <family voice token>   body: { intent, heard, ...slots }
// We act on that family's data only and reply { speech } for HA to say out loud.
// Every request is logged so the wall can show what it heard and what it did.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import {
  addDays, clean, dayFrom, listJoin, localDate, localToUtc, matchPerson, matchTask, parseCommand, parseWhen, repeatsOn, speakTime,
  type Person, type TaskLite,
} from './logic.ts'
import { categorise } from './categories.ts'
import { STARTER_DISHES } from './starter.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-voice-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ speech: 'Voice commands must be sent with POST.' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Who is asking: Home Assistant with a family voice key, or a signed-in family member (the app's mic button)
  const voiceKey = req.headers.get('x-voice-token') ?? ''
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const key = voiceKey || (bearer.startsWith('fam_') ? bearer : '')
  let hh: string
  if (key) {
    const { data: tok } = await admin.from('voice_tokens').select('id, household_id').eq('token_hash', await sha256(key)).maybeSingle()
    if (!tok) return json({ speech: "I'm not connected to the family calendar. Make a new voice key in Parents." }, 401)
    hh = tok.household_id
    void admin.from('voice_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', tok.id)
  } else {
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${bearer}` } } })
    const { data: mine } = bearer ? await asUser.rpc('current_household_id') : { data: null }
    if (!mine) return json({ speech: "I'm not connected to the family calendar yet." }, 401)
    hh = mine as string
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  // Free text from the app: work out the command the same way Home Assistant's sentences do
  if (!body.intent && typeof body.text === 'string') Object.assign(body, parseCommand(body.text), { heard: body.text })
  const intent = str(body.intent, 40)
  const heard = str(body.heard, 300) || null

  const { data: tzRow } = await admin.from('settings').select('value').eq('household_id', hh).eq('key', 'timezone').maybeSingle()
  const TZ = typeof tzRow?.value === 'string' ? tzRow.value : 'Europe/London'
  const now = Date.now()
  const today = localDate(now, TZ)
  const { data: peopleRows } = await admin.from('family_members').select('id, name, role').eq('household_id', hh).order('sort_order')
  const people = (peopleRows ?? []) as Person[]

  let ok = true
  const reply = async (said: string) => {
    const speech = said.replace(/(^|[.!?]\s+)([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase())
    await admin.from('voice_log').insert({ household_id: hh, heard, reply: speech, intent: intent || null, ok })
    return json({ speech })
  }
  const fail = (speech: string) => { ok = false; return reply(speech) }

  // ---------- Lists ----------
  if (intent === 'add_item' || intent === 'read_list') {
    const wanted = clean(str(body.list, 60)).replace(/\b(list|the)\b/g, '').trim()
    const { data: lists } = await admin.from('lists').select('id, name, kind').eq('household_id', hh).order('sort_order')
    const all = lists ?? []
    const grocery = all.find((l) => l.kind === 'grocery') ?? all[0]
    const isShopping = !wanted || /\b(shop|shopping|grocery|groceries|food)\b/.test(wanted)
    const list = isShopping ? grocery : all.find((l) => clean(l.name).includes(wanted)) ?? null
    if (!list) return fail(wanted ? `I couldn't find a ${wanted} list.` : "There isn't a list yet. Add one on the wall first.")

    if (intent === 'add_item') {
      const items = str(body.item, 120).split(/\s*(?:,|\band\b|&)\s*/i).map((s) => clean(s).replace(/^(some|a|an|more)\s+/, '')).filter(Boolean).slice(0, 8)
      if (!items.length) return fail('What should I add?')
      const { data: existing } = await admin.from('list_items').select('text').eq('list_id', list.id).eq('done', false)
      const have = new Set((existing ?? []).map((e: { text: string }) => clean(e.text)))
      const fresh = items.filter((i) => !have.has(i))
      if (fresh.length) {
        await admin.from('list_items').insert(fresh.map((text) => ({
          household_id: hh, list_id: list.id, text: text[0].toUpperCase() + text.slice(1),
          category: list.kind === 'grocery' ? categorise(text) : null,
        })))
      }
      const already = items.filter((i) => have.has(i))
      if (!fresh.length) return reply(`${listJoin(already)} ${already.length > 1 ? 'are' : 'is'} already on the ${list.name} list.`)
      return reply(`Added ${listJoin(fresh)} to the ${list.name} list.${already.length ? ` ${listJoin(already)} was already there.` : ''}`)
    }
    const { data: items } = await admin.from('list_items').select('text').eq('list_id', list.id).eq('done', false).order('created_at').limit(30)
    const names = (items ?? []).map((i: { text: string }) => i.text)
    if (!names.length) return reply(`The ${list.name} list is empty.`)
    return reply(`${names.length} on the ${list.name} list: ${listJoin(names.slice(0, 15))}${names.length > 15 ? ', and more' : ''}.`)
  }

  // ---------- What's on ----------
  if (intent === 'whats_on') {
    const { date, label } = dayFrom(`${str(body.day, 40)} ${heard ?? ''}`, now, TZ)
    const start = localToUtc(date, 0, 0, TZ), end = localToUtc(addDays(date, 1), 0, 0, TZ)
    const who = str(body.who, 40) ? matchPerson(str(body.who, 40), people) : null
    const { data: evs } = await admin.from('events').select('title, starts_at, ends_at, all_day, member_ids, recurrence_rule')
      .eq('household_id', hh).is('recurrence_rule', null)
      .lt('starts_at', new Date(end).toISOString()).gt('ends_at', new Date(start).toISOString()).order('starts_at').limit(40)
    const { data: reps } = await admin.from('events').select('title, starts_at, ends_at, all_day, member_ids, recurrence_rule')
      .eq('household_id', hh).not('recurrence_rule', 'is', null).lt('starts_at', new Date(end).toISOString())
    type Ev = { title: string; starts_at: string; ends_at: string; all_day: boolean; member_ids: string[]; recurrence_rule: string | null }
    const day: { t: number; all: boolean; title: string; who: string[] }[] = []
    for (const e of (evs ?? []) as Ev[]) day.push({ t: Date.parse(e.starts_at), all: e.all_day, title: e.title, who: e.member_ids })
    for (const e of (reps ?? []) as Ev[]) {
      const sd = e.all_day ? e.starts_at.slice(0, 10) : localDate(Date.parse(e.starts_at), TZ)
      if (!repeatsOn(e.recurrence_rule!, sd, date)) continue
      const st = new Date(e.starts_at)
      const hm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(st).split(':').map(Number)
      day.push({ t: e.all_day ? start : localToUtc(date, hm[0], hm[1], TZ), all: e.all_day, title: e.title, who: e.member_ids })
    }
    const mine = (who ? day.filter((e) => !e.who?.length || e.who.includes(who.id)) : day)
      .filter((e) => label !== 'today' || e.all || e.t >= now - 30 * 60000)
      .sort((a, b) => Number(b.all) - Number(a.all) || a.t - b.t)
    const forWho = who ? ` for ${who.name}` : ''
    if (!mine.length) return reply(`Nothing on the calendar${forWho} ${label}${label === 'today' ? ' from now on' : ''}.`)
    const said = mine.slice(0, 6).map((e) => e.all ? `${e.title} all day` : `${e.title} at ${speakTime(e.t, TZ)}`)
    return reply(`${label[0].toUpperCase()}${label.slice(1)}${forWho}: ${listJoin(said)}${mine.length > 6 ? `, plus ${mine.length - 6} more` : ''}.`)
  }

  // ---------- Meals ----------
  if (intent === 'meal') {
    const { date, label } = dayFrom(`${str(body.day, 60)} ${heard ?? ''}`, now, TZ)
    const said = clean(str(body.slot, 20))
    const slot = said === 'tea' || said === 'supper' || (!said && /\btonight\b/i.test(heard ?? '')) ? 'dinner' : (['breakfast', 'lunch', 'dinner'].includes(said) ? said : '')
    const { data: rows } = await admin.from('meal_plan').select('slot, title').eq('household_id', hh).eq('date', date)
    const meals = (rows ?? []) as { slot: string; title: string }[]
    const order = ['breakfast', 'lunch', 'dinner']
    if (slot) {
      const these = meals.filter((x) => x.slot === slot).map((x) => x.title)
      const when = label === 'today' ? (slot === 'dinner' ? 'tonight' : 'today') : label
      if (!these.length) return reply(`Nothing planned for ${slot} ${when} yet. You can add it in Meals.`)
      return reply(`${slot[0].toUpperCase()}${slot.slice(1)} ${when} is ${listJoin(these)}.`)
    }
    if (!meals.length) return reply(`No meals planned ${label} yet. You can add them in Meals.`)
    const parts = order.map((o) => [o, meals.filter((x) => x.slot === o).map((x) => x.title)] as const).filter(([, t]) => t.length).map(([o, t]) => `${o} is ${listJoin(t)}`)
    return reply(`${label[0].toUpperCase()}${label.slice(1)}, ${listJoin(parts)}.`)
  }

  // ---------- Add to the weekly menu ----------
  if (intent === 'plan_meal') {
    const said = str(body.dish, 80).replace(/^(some|a|an)\s+/i, '').trim()
    if (!said) return fail('Which dish? Try "add dosa for breakfast on Monday".')
    const slotWord = clean(str(body.slot, 20))
    const slot = slotWord === 'tea' || slotWord === 'supper' ? 'dinner' : (['breakfast', 'lunch', 'dinner'].includes(slotWord) ? slotWord : 'dinner')
    const dayWord = clean(str(body.day, 20)) === 'tonight' ? 'today' : str(body.day, 20)
    const { date, label } = dayFrom(dayWord || 'today', now, TZ)
    const want = clean(said)
    // Best match: the family's own dishes, then the ready-made ones
    const { data: mine } = await admin.from('dishes').select('id, name, ingredients').eq('household_id', hh)
    const score = (name: string) => { const n = clean(name); return n === want ? 3 : n.startsWith(want) || want.startsWith(n) ? 2 : n.includes(want) ? 1 : 0 }
    const pick = <T extends { name: string }>(xs: T[]) => xs.map((x) => [score(x.name), x] as const).filter(([sc]) => sc > 0).sort((a, b) => b[0] - a[0])[0]?.[1]
    let dish = pick((mine ?? []) as { id: string; name: string; ingredients: string[] }[])
    if (!dish) {
      const idea = pick(STARTER_DISHES)
      const name = idea?.name ?? said[0].toUpperCase() + said.slice(1)
      // Simple foods ("oats", "fruit salad") are their own ingredient; bigger dishes start empty for a parent to fill in
      const ingredients = idea?.ingredients ?? (want.split(' ').length <= 2 ? [want] : [])
      const { data: made } = await admin.from('dishes').insert({ household_id: hh, name, ingredients }).select('id, name, ingredients').single()
      dish = made ?? undefined
      if (!dish) { const { data: again } = await admin.from('dishes').select('id, name, ingredients').eq('household_id', hh).ilike('name', name).maybeSingle(); dish = again ?? undefined }
    }
    if (!dish) return fail("Sorry, I couldn't add that to the menu. Try in Meals.")
    await admin.from('meal_plan').insert({ household_id: hh, date, slot, dish_id: dish.id, title: dish.name })
    const when = label === 'today' ? (slot === 'dinner' ? 'tonight' : 'today') : label
    const note = dish.ingredients?.length ? '' : ' Add its ingredients in Meals so it goes on the shopping list.'
    return reply(`Added ${dish.name} for ${slot} ${when}.${note}`)
  }

  // ---------- Reminders ----------
  if (intent === 'remind') {
    const what = str(body.what, 200).replace(/^(to|that)\s+/i, '')
    const when = parseWhen(str(body.when, 80), now, TZ)
    if (!what) return fail('What should I remind you about?')
    if (!when) return fail(`I didn't catch when. Try "remind me at 5 pm to ${what}".`)
    const whoSaid = clean(str(body.who, 40))
    const who = whoSaid && !/^(me|us|everyone|everybody|the family)$/.test(whoSaid) ? matchPerson(whoSaid, people) : null
    if (whoSaid && !who && !/^(me|us|everyone|everybody|the family)$/.test(whoSaid)) return fail(`I don't know who ${whoSaid} is.`)
    await admin.from('reminders').insert({ household_id: hh, text: what[0].toUpperCase() + what.slice(1), due_at: new Date(when).toISOString(), member_id: who?.id ?? null })
    const dayWord = localDate(when, TZ) === today ? '' : localDate(when, TZ) === addDays(today, 1) ? ' tomorrow' : ` on ${new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long' }).format(new Date(when))}`
    return reply(`OK, I'll remind ${who ? who.name : 'you'} at ${speakTime(when, TZ)}${dayWord} to ${what}.`)
  }

  // ---------- Tasks ----------
  if (intent === 'task_done') {
    const whoSaid = /^(i|me|we|i have|ive)$/i.test(str(body.who, 40)) ? '' : str(body.who, 40)
    const who = matchPerson(whoSaid, people)
    if (!who) return fail(whoSaid ? `I don't know who ${whoSaid} is.` : 'Who finished it? Say the name, like "Ava brushed her teeth".')
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay()
    const { data: taskRows } = await admin.from('tasks').select('id, title, assignee_ids, all_members, days_of_week, active, stars, needs_approval').eq('household_id', hh).eq('active', true)
    const theirs = ((taskRows ?? []) as TaskLite[]).filter((t) => t.days_of_week.includes(dow) && (t.all_members || t.assignee_ids.includes(who.id)))
    const task = matchTask(str(body.task, 120), theirs)
    if (!task) return fail(`I couldn't find that in ${who.name}'s tasks for today.`)
    const { data: done } = await admin.from('task_completions').select('id, status').eq('task_id', task.id).eq('member_id', who.id).eq('date', today).maybeSingle()
    if (done) return reply(done.status === 'awaiting_approval' ? `${task.title} is already waiting for a grown-up to check.` : `${who.name} already did ${task.title} today. Well done!`)
    const status = task.needs_approval && who.role === 'kid' ? 'awaiting_approval' : 'done'
    const { data: comp, error } = await admin.from('task_completions').insert({ household_id: hh, task_id: task.id, member_id: who.id, date: today, status }).select('id').single()
    if (error || !comp) return fail("Sorry, I couldn't tick that. Try on the wall.")
    if (status === 'awaiting_approval') return reply(`Nice one, ${who.name}! I've asked a grown-up to check ${task.title}.`)
    if (task.stars > 0) await admin.from('star_ledger').insert({ household_id: hh, member_id: who.id, date: today, delta: task.stars, reason: task.title, source: 'task', completion_id: comp.id })
    return reply(`Well done ${who.name}! ${task.title} is ticked${task.stars > 0 ? `, that's ${task.stars} star${task.stars > 1 ? 's' : ''}` : ''}.`)
  }

  if (intent === 'stars') {
    const who = matchPerson(str(body.who, 40), people)
    if (!who) return fail('Whose stars? Say the name, like "how many stars does Ava have".')
    const { data: rows } = await admin.from('star_ledger').select('delta').eq('member_id', who.id).eq('household_id', hh)
    const total = (rows ?? []).reduce((a: number, r: { delta: number }) => a + r.delta, 0)
    const { data: goal } = await admin.from('rewards').select('name, star_target, is_surprise').eq('member_id', who.id).eq('household_id', hh)
      .is('claimed_at', null).order('star_target').limit(1).maybeSingle()
    const left = goal ? goal.star_target - total : 0
    const next = goal && left > 0 ? ` ${left} more until ${goal.is_surprise ? 'a surprise' : goal.name}!` : goal ? ` That's enough for ${goal.is_surprise ? 'the surprise' : goal.name}!` : ''
    return reply(`${who.name} has ${total} star${total === 1 ? '' : 's'}.${next}`)
  }

  return fail(heard ? `Sorry, I don't know how to do that yet. Try "add milk to the shopping list" or "what's on tomorrow?"` : "Sorry, I can't do that yet.")
})

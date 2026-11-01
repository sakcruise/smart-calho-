// Pure helpers for the voice function: matching spoken words to people and tasks, and reading times.
// No database or network here, so it can be tested on its own.

export interface Person { id: string; name: string; role: string }
export interface TaskLite { id: string; title: string; assignee_ids: string[]; all_members: boolean; days_of_week: number[]; active: boolean; stars: number; needs_approval: boolean }

const STOP = new Set(['the', 'a', 'an', 'my', 'his', 'her', 'their', 'our', 'your', 'some', 'to', 'of', 'up', 'out', 'off', 'on', 'in', 'and', 'all', 'has', 'have', 'had', 'just', 'already', 'did', 'done', 'finished', 'completed'])

/** Lower case, no punctuation, single spaces. */
export function clean(s: string): string {
  return String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9: ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Rough word stem so "brushed", "brushing" and "brush" match, and "teeth"/"tooth". */
export function stem(w: string): string {
  if (w === 'teeth') return 'tooth'
  if (w === 'clothes') return 'cloth'
  return w.replace(/(ing|ed|es|s)$/, '').replace(/(.)\1$/, '$1')
}

function words(s: string): string[] {
  return clean(s).split(' ').filter((w) => w && !STOP.has(w)).map(stem)
}

/** Find a family member by spoken name ("Ava", "ava's"), or null. */
export function matchPerson(spoken: string, people: Person[]): Person | null {
  const said = clean(spoken).replace(/s$/, '')
  if (!said) return null
  return people.find((p) => clean(p.name) === said)
    ?? people.find((p) => clean(p.name).split(' ')[0] === said.split(' ')[0])
    ?? people.find((p) => said.includes(clean(p.name).split(' ')[0]))
    ?? null
}

/** Best task for a spoken phrase, from the tasks this person has today. Needs at least one real word in common. */
export function matchTask(spoken: string, tasks: TaskLite[]): TaskLite | null {
  const said = new Set(words(spoken))
  let best: TaskLite | null = null, bestScore = 0
  for (const t of tasks) {
    const tw = words(t.title)
    if (!tw.length) continue
    const hits = tw.filter((w) => said.has(w)).length
    const score = hits / tw.length + hits * 0.01
    if (hits > 0 && score > bestScore) { best = t; bestScore = score }
  }
  return best
}

// ---- Time in the family's time zone ----

/** Minutes the zone is ahead of UTC at instant t. */
export function tzOffsetMinutes(t: number, timeZone: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t)).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return Math.round((asUtc - Math.floor(t / 1000) * 1000) / 60000)
}

/** Local calendar date "YYYY-MM-DD" at instant t. */
export function localDate(t: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t))
}

/** UTC instant of local wall-clock time on a local date. */
export function localToUtc(date: string, hour: number, minute: number, timeZone: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, m - 1, d, hour, minute)
  const first = guess - tzOffsetMinutes(guess, timeZone) * 60000
  return guess - tzOffsetMinutes(first, timeZone) * 60000
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** "9 am", "5:30 pm" */
export function speakTime(t: number, timeZone: string): string {
  const s = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(t))
  return s.replace(':00', '').replace(/\s?AM/i, ' am').replace(/\s?PM/i, ' pm')
}

const NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty five': 45, fortyfive: 45, a: 1, an: 1,
}

function num(s: string): number | null {
  if (/^\d+$/.test(s)) return Number(s)
  return NUM[s] ?? null
}

/** Which day a sentence is about: today (default), tomorrow, or a named weekday. */
export function dayFrom(spoken: string, now: number, timeZone: string): { date: string; label: string } {
  const s = clean(spoken)
  const today = localDate(now, timeZone)
  if (/\btomorrow\b/.test(s)) return { date: addDays(today, 1), label: 'tomorrow' }
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const named = days.findIndex((d) => new RegExp(`\\b${d}\\b`).test(s))
  if (named >= 0) {
    const [y, m, d] = today.split('-').map(Number)
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
    const ahead = (named - dow + 7) % 7
    return { date: addDays(today, ahead), label: ahead === 0 ? 'today' : `on ${days[named][0].toUpperCase()}${days[named].slice(1)}` }
  }
  return { date: today, label: 'today' }
}

/**
 * When to remind: "in 10 minutes", "in an hour", "at 5", "at 5:30 pm", "at half past 6", "tomorrow at 8 am", "tonight at 7".
 * A bare hour picks the next time it comes round (so "at 5" in the afternoon means 5 pm). Null if not understood.
 */
export function parseWhen(spoken: string, now: number, timeZone: string): number | null {
  const s = clean(spoken).replace(/\b(a m|am)\b/g, 'am').replace(/\b(p m|pm)\b/g, 'pm').replace(/o clock/g, '')
  const rel = s.match(/\bin (\d+|[a-z]+(?: [a-z]+)?) (minute|min|hour|hr)s?\b/)
  if (rel) {
    const n = num(rel[1]) ?? (rel[1] === 'half an' ? 0.5 : null)
    if (n == null) return null
    return now + n * (rel[2].startsWith('h') ? 3600000 : 60000)
  }
  if (/\bin half an hour\b/.test(s)) return now + 1800000

  let hour: number | null = null, minute = 0
  const half = s.match(/\bhalf past (\d+|[a-z]+)\b/)
  const quarterPast = s.match(/\bquarter past (\d+|[a-z]+)\b/)
  const quarterTo = s.match(/\bquarter to (\d+|[a-z]+)\b/)
  const clock = s.match(/\b(?:at )?(\d{1,2})(?::| )?(\d{2})?\s?(am|pm)?\b/)
  const word = s.match(/\bat ([a-z]+)(?: (fifteen|thirty|forty five|fortyfive))?\s?(am|pm)?\b/)
  let ampm: string | undefined
  if (half) { hour = num(half[1]); minute = 30 }
  else if (quarterPast) { hour = num(quarterPast[1]); minute = 15 }
  else if (quarterTo) { const h = num(quarterTo[1]); hour = h == null ? null : (h + 11) % 12 || 12; minute = 45 }
  else if (clock && /\bat\b/.test(s)) { hour = Number(clock[1]); minute = clock[2] ? Number(clock[2]) : 0; ampm = clock[3] }
  else if (word && num(word[1]) != null) { hour = num(word[1]); minute = word[2] ? NUM[word[2]] ?? 0 : 0; ampm = word[3] }
  ampm = ampm ?? s.match(/\b(am|pm)\b/)?.[1]
  if (hour == null || hour > 23 || minute > 59) return null
  if (/\b(tonight|evening|afternoon)\b/.test(s) && !ampm && hour < 12) ampm = 'pm'
  if (/\bmorning\b/.test(s) && !ampm) ampm = 'am'

  const today = localDate(now, timeZone)
  let date = /\btomorrow\b/.test(s) ? addDays(today, 1) : today
  const at = (h: number) => localToUtc(date, h, minute, timeZone)
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  if (ampm || hour >= 13 || date !== today) {
    let t = at(hour)
    if (t <= now && date === today) { date = addDays(today, 1); t = localToUtc(date, hour, minute, timeZone) }
    return t
  }
  // Bare hour today: next time it comes round
  for (const h of [hour, hour + 12]) { if (h < 24 && at(h) > now) return at(h) }
  date = addDays(today, 1)
  return localToUtc(date, hour, minute, timeZone)
}

/** Does a repeating local event (daily/weekly/monthly/yearly) fall on this local date? */
export function repeatsOn(rule: string, startDate: string, date: string): boolean {
  if (date < startDate) return false
  const [y1, m1, d1] = startDate.split('-').map(Number)
  const [y2, m2, d2] = date.split('-').map(Number)
  switch (rule) {
    case 'daily': return true
    case 'weekly': return ((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) % 7 === 0
    case 'monthly': return d1 === d2
    case 'yearly': return d1 === d2 && m1 === m2
    default: return false
  }
}

/** "a, b and c" */
export function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const DONE_VERBS = 'did|done|finished|completed|brushed|made|tidied|packed|cleaned|fed|read|got|put|emptied|washed|set|cleared|took|practised|practiced|watered|walked|hoovered|folded|unloaded|loaded|wiped|changed|had'

/**
 * Typed or phone-dictated sentence → intent and slots (the same commands Home Assistant understands).
 * Returns intent '' when it isn't a command we know.
 */
export function parseCommand(text: string): Record<string, string> {
  const s = clean(text).replace(/^(hey |ok |okay )?(jarvis|calendar|family)\s*/, '').replace(/^(please |can you |could you )+/, '').replace(/ please$/, '')
  let m: RegExpMatchArray | null

  // Lists
  if ((m = s.match(/^(?:whats|what is) on (?:the |my |our )?(.+?) list$/)) || (m = s.match(/^read (?:me )?(?:out )?(?:the |my |our )?(.+?) list$/))) return { intent: 'read_list', list: m[1] }
  if (/^what do we need\b/.test(s) || /^(?:whats|what is) on (?:the |our )?list$/.test(s)) return { intent: 'read_list', list: 'shopping' }
  if ((m = s.match(/^(?:add|put) (.+?) (?:to|on|onto) (?:the |my |our )?(?:(.+?) )?list$/))) return { intent: 'add_item', item: m[1], list: m[2] ?? '' }
  if ((m = s.match(/^(?:we need|we are out of|were out of|we are running out of|were running out of|we are low on|were low on|buy|get) (?:some |more )?(.+)$/))) return { intent: 'add_item', item: m[1], list: '' }
  if ((m = s.match(/^add (.+)$/))) return { intent: 'add_item', item: m[1], list: '' }

  // Stars
  if ((m = s.match(/^how many stars (?:does|has|have|did) (.+?)(?: got| have| earned| get)?$/))) return { intent: 'stars', who: m[1] }

  // Reminders
  if ((m = s.match(/^remind (me|us|everyone|[a-z]+) (.+)$/))) {
    const who = m[1], rest = m[2]
    if (rest.startsWith('to ')) {
      const t = rest.slice(3).match(/^(.+?)\s+((?:(?:tomorrow|tonight|this evening|in the morning)\s+)?(?:at|in)\s+.+|tomorrow|tonight)$/)
      return t ? { intent: 'remind', who, what: t[1], when: t[2] } : { intent: 'remind', who, what: rest.slice(3), when: '' }
    }
    const t = rest.match(/^(.+?)\s+to\s+(.+)$/)
    return t ? { intent: 'remind', who, when: t[1], what: t[2] } : { intent: 'remind', who, what: rest, when: '' }
  }

  // What's on
  if ((m = s.match(/^(?:whats|what is|what are) ([a-z]+) doing\b/)) && !['we', 'you'].includes(m[1])) return { intent: 'whats_on', who: m[1], day: s }
  if (/^(?:whats|what is) (?:on|happening|the plan)\b/.test(s) || /^what are we doing\b/.test(s) || /^(?:whats|what is) (?:on )?(?:the )?(?:calendar|schedule)\b/.test(s)) {
    const who = s.match(/\bfor ([a-z]+)\b/)?.[1]
    return { intent: 'whats_on', who: who && !['today', 'tomorrow', 'us', 'everyone'].includes(who) ? who : '', day: s }
  }

  // Tasks
  if ((m = s.match(/^(?:tick|mark) (?:off )?(.+?) (?:as )?(?:done |off )?for ([a-z]+)$/))) return { intent: 'task_done', who: m[2], task: m[1] }
  if ((m = s.match(new RegExp(`^([a-z]+) (?:has |have )?(?:${DONE_VERBS}) (.+)$`)))) return { intent: 'task_done', who: m[1], task: m[2] }

  return { intent: '' }
}

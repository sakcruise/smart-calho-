import { useMemo, useState, type FormEvent } from 'react'
import { Plus, ShoppingBasket, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../lib/useTable'
import type { List, ListItem } from '../../lib/types'
import { CATEGORY_ORDER, categorise } from '../lists/categories'
import { LEVELS, pantryKey, runningLow, runsOutAt, type Forecast, type Level, type PantryItem } from './logic'

const LEVEL_LABEL: Record<Level, string> = { full: 'Full', half: 'Half', low: 'Low', out: 'Out' }
const LEVEL_STYLE: Record<Level, string> = {
  full: 'bg-green-100 text-green-900', half: 'bg-cream text-ink-2', low: 'bg-amber text-ink', out: 'bg-red-100 text-red-900',
}

function ago(iso: string | null): string {
  if (!iso) return 'not bought through the list yet'
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000)
  return days <= 0 ? 'bought today' : days === 1 ? 'bought yesterday' : `bought ${days} days ago`
}

function when(d: Date): string {
  const days = Math.round((d.getTime() - Date.now()) / 86400000)
  if (days <= 0) return 'probably finished by now'
  if (days === 1) return 'likely to run out tomorrow'
  if (days < 7) return `likely to run out ${d.toLocaleDateString('en-GB', { weekday: 'long' })}`
  return `lasts about ${days} more days`
}

/** What's at home: stocked automatically when shopping is ticked off, with a guess at when things run out. */
export function Pantry() {
  const { rows: pantry } = useTable<PantryItem>('pantry_items', 'name')
  const { rows: forecasts } = useTable<Forecast>('pantry_forecast', 'key')
  const { rows: lists } = useTable<List>('lists', 'sort_order')
  const { rows: items } = useTable<ListItem>('list_items', 'created_at')
  const [text, setText] = useState('')
  const [confirm, setConfirm] = useState<string | null>(null)

  const grocery = lists.find((l) => l.kind === 'grocery') ?? lists[0] ?? null
  const fc = useMemo(() => new Map(forecasts.map((f) => [f.key, f])), [forecasts])
  const onListKeys = useMemo(() => new Set(items.filter((i) => i.list_id === grocery?.id && !i.done).map((i) => pantryKey(i.text))), [items, grocery])
  const low = pantry.filter((p) => runningLow(p, fc.get(p.key)))

  const grouped = useMemo(() => {
    const m = new Map<string, PantryItem[]>()
    for (const p of pantry) { const c = categorise(p.name); m.set(c, [...(m.get(c) ?? []), p]) }
    return [...m.entries()].sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]))
  }, [pantry])

  async function add(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!supabase || !t) return
    setText('')
    await supabase.from('pantry_items').upsert({ name: t[0].toUpperCase() + t.slice(1), key: pantryKey(t), level: 'full', updated_at: new Date().toISOString() }, { onConflict: 'household_id,key' })
  }

  async function cycle(p: PantryItem) {
    const next = LEVELS[(LEVELS.indexOf(p.level) + 1) % LEVELS.length]
    await supabase?.from('pantry_items').update({ level: next, updated_at: new Date().toISOString() }).eq('id', p.id)
  }

  async function addToList(p: PantryItem) {
    if (!supabase || !grocery) return
    await supabase.from('list_items').insert({ list_id: grocery.id, text: p.name, category: grocery.kind === 'grocery' ? categorise(p.name) : null })
  }

  return (
    <div className="flex flex-col gap-5">
      {low.length > 0 && (
        <section className="flex flex-col gap-3 rounded-3xl border-2 border-amber bg-white p-4 lg:p-5">
          <h2 className="text-xl font-black">Running low</h2>
          <ul className="flex flex-col gap-2">
            {low.map((p) => {
              const at = runsOutAt(p, fc.get(p.key))
              const listed = onListKeys.has(p.key)
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-cream px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-lg font-extrabold">{p.name}</span>
                    <span className="text-sm font-bold text-muted">{p.level === 'out' ? 'Finished' : p.level === 'low' ? 'Marked as low' : at ? when(at) : ''}</span>
                  </span>
                  {listed
                    ? <span className="rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-muted">On the list</span>
                    : <button type="button" onClick={() => void addToList(p)} disabled={!grocery} className="flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 font-extrabold"><ShoppingBasket size={16} aria-hidden="true" />Add to list</button>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <form onSubmit={add} className="flex gap-2">
        <input id="pantry-add" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add something you have at home, e.g. rice"
          className="min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg font-bold" />
        <button type="submit" disabled={!text.trim()} aria-label="Add to pantry" className="rounded-2xl bg-ink px-4 text-white disabled:opacity-40"><Plus /></button>
      </form>
      <p className="text-sm font-bold text-muted">Ticking things off the shopping list adds them here as Full. Tap the level when something's running out. After a few shops it learns how long things last.</p>

      {pantry.length === 0 && <p className="rounded-3xl bg-white p-6 text-center text-lg font-bold text-muted">Nothing here yet. Do a shop and tick items off the list, or add things above.</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map(([cat, ps]) => (
          <section key={cat} className="flex flex-col gap-2 rounded-3xl bg-white p-4">
            <h3 className="text-sm font-extrabold uppercase tracking-[0.08em] text-faint">{cat}</h3>
            {ps.map((p) => {
              const f = fc.get(p.key)
              const at = runsOutAt(p, f)
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-lg font-extrabold">{p.name}</span>
                    <span className="truncate text-sm font-bold text-muted">{ago(p.last_bought_at)}{f?.avg_days ? ` · usually lasts ${Math.max(1, Math.round(f.avg_days))} days` : ''}{at && p.level !== 'out' ? ` · ${when(at)}` : ''}</span>
                  </span>
                  <button type="button" onClick={() => void cycle(p)} aria-label={`${p.name}: ${LEVEL_LABEL[p.level]}. Tap to change`}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-extrabold ${LEVEL_STYLE[p.level]}`}>{LEVEL_LABEL[p.level]}</button>
                  {confirm === p.id
                    ? <button type="button" onClick={() => { void supabase?.from('pantry_items').delete().eq('id', p.id).then(() => undefined); setConfirm(null) }} className="shrink-0 rounded-full bg-red-700 px-3 py-1.5 text-sm font-extrabold text-white">Remove</button>
                    : <button type="button" onClick={() => setConfirm(p.id)} aria-label={`Remove ${p.name}`} className="shrink-0 rounded-full p-1.5 text-faint"><Trash2 size={16} /></button>}
                </div>
              )
            })}
          </section>
        ))}
      </div>
    </div>
  )
}

import { useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, ShoppingBasket, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../lib/useTable'
import type { List, ListItem } from '../../lib/types'
import { categorise } from '../lists/categories'
import { SLOTS, dateKey, onList, runningLow, shoppingFor, weekDays, weekStart, type Dish, type Forecast, type Meal, type Needed, type PantryItem, type Slot } from './logic'
import { Pantry } from './Pantry'
import { PANTRY_STAPLES, STARTER_DISHES } from './starter'

const dayName = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long' })
const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

type Picking = { date: string; slot: Slot } | null

/** Plan the week's breakfasts, lunches and dinners, then turn them into a shopping list. */
export function Meals() {
  const { rows: dishes } = useTable<Dish>('dishes', 'name')
  const { rows: plan } = useTable<Meal>('meal_plan', 'created_at')
  const { rows: lists } = useTable<List>('lists', 'sort_order')
  const { rows: items } = useTable<ListItem>('list_items', 'created_at')
  // On Saturday and Sunday you're usually planning next week
  const [offset, setOffset] = useState(() => ([0, 6].includes(new Date().getDay()) ? 1 : 0))
  const [picking, setPicking] = useState<Picking>(null)
  const [viewing, setViewing] = useState<Meal | null>(null)
  const [editing, setEditing] = useState<Dish | null>(null)
  const [shopping, setShopping] = useState(false)
  const [view, setView] = useState<'menu' | 'pantry'>('menu')
  const { rows: pantry } = useTable<PantryItem>('pantry_items', 'name')
  const { rows: forecasts } = useTable<Forecast>('pantry_forecast', 'key')

  const start = weekStart(new Date(), offset)
  const days = weekDays(start)
  const keys = days.map(dateKey)
  const today = dateKey(new Date())
  const weekMeals = useMemo(() => plan.filter((m) => keys.includes(m.date)), [plan, keys.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const mealsAt = (date: string, slot: Slot) => weekMeals.filter((m) => m.date === date && m.slot === slot)
  const label = offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : `Week of ${shortDate(start)}`

  async function addMeal(p: NonNullable<Picking>, dish: Dish) {
    await supabase?.from('meal_plan').insert({ date: p.date, slot: p.slot, dish_id: dish.id, title: dish.name })
  }

  return (
    <div className="flex flex-col gap-5 p-4 lg:gap-6 lg:p-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-black lg:text-4xl">Meals</h1>
        <div className="mr-auto flex rounded-full bg-white p-1" role="tablist">
          {(['menu', 'pantry'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`rounded-full px-4 py-2 font-extrabold lg:text-lg ${view === v ? 'bg-ink text-white' : 'text-ink-2'}`}>{v === 'menu' ? 'Week menu' : 'At home'}</button>
          ))}
        </div>
        {view === 'menu' && <>
        <div className="flex items-center gap-1 rounded-full bg-white p-1">
          <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week" className="rounded-full p-2 text-ink-2"><ChevronLeft /></button>
          <span className="min-w-36 text-center font-extrabold lg:text-lg">{label}<span className="block text-xs font-bold text-muted">{shortDate(days[0])} – {shortDate(days[6])}</span></span>
          <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Next week" className="rounded-full p-2 text-ink-2"><ChevronRight /></button>
        </div>
        <button type="button" onClick={() => setShopping(true)} disabled={!weekMeals.length}
          className="flex items-center gap-2 rounded-full bg-amber px-5 py-3 font-extrabold disabled:opacity-40 lg:text-lg">
          <ShoppingBasket aria-hidden="true" />Make shopping list
        </button>
        </>}
      </div>

      {view === 'pantry' && <Pantry />}

      {/* Phone: one card per day. Wall: a 7-day grid. */}
      {view === 'menu' && <div className="grid gap-3 lg:grid-cols-7 lg:gap-3">
        {days.map((d, i) => (
          <div key={keys[i]} className={`flex flex-col gap-2 rounded-3xl bg-white p-3 lg:p-3 ${keys[i] === today ? 'ring-4 ring-amber' : ''}`}>
            <div className="flex items-baseline justify-between px-1">
              <span className="text-lg font-black">{dayName(d)}</span>
              <span className="text-sm font-bold text-muted">{shortDate(d)}</span>
            </div>
            {SLOTS.map((s) => (
              <div key={s.id} className="flex flex-col gap-1.5 rounded-2xl bg-cream p-2">
                <span className="px-1 text-xs font-extrabold uppercase tracking-[0.08em] text-faint">{s.label}</span>
                {mealsAt(keys[i], s.id).map((m) => (
                  <button key={m.id} type="button" onClick={() => setViewing(m)}
                    className="rounded-xl bg-white px-3 py-2 text-left font-extrabold leading-tight shadow-sm">{m.title}</button>
                ))}
                <button type="button" onClick={() => setPicking({ date: keys[i], slot: s.id })} aria-label={`Add ${s.label.toLowerCase()} on ${dayName(d)}`}
                  className="flex items-center justify-center rounded-xl border-2 border-dashed border-line py-1.5 text-muted"><Plus size={18} /></button>
              </div>
            ))}
          </div>
        ))}
      </div>}

      {picking && <DishPicker dishes={dishes} onClose={() => setPicking(null)}
        title={`${SLOTS.find((s) => s.id === picking.slot)!.label}, ${dayName(new Date(`${picking.date}T12:00:00`))}`}
        onPick={async (dish, isNew) => { const p = picking; setPicking(null); await addMeal(p, dish); if (isNew) setEditing(dish) }} />}

      {viewing && (
        <MealSheet meal={viewing} dish={dishes.find((d) => d.id === viewing.dish_id) ?? null} onClose={() => setViewing(null)}
          onEdit={(d) => { setViewing(null); setEditing(d) }}
          onRemove={async () => { await supabase?.from('meal_plan').delete().eq('id', viewing.id); setViewing(null) }} />
      )}

      {editing && <DishEditor dish={editing} onClose={() => setEditing(null)} />}

      {shopping && (
        <ShoppingReview meals={weekMeals} dishes={dishes} lists={lists} items={items} pantry={pantry} forecasts={forecasts} weekLabel={label.toLowerCase()} onClose={() => setShopping(false)}
          onEditDish={(d) => { setShopping(false); setEditing(d) }} />
      )}
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-[32px] bg-cream p-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:rounded-[32px] lg:p-8">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-ink-2"><X /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Choose one of the family's dishes, a ready-made one, or type a new one. */
function DishPicker({ title, dishes, onPick, onClose }: { title: string; dishes: Dish[]; onPick: (d: Dish, isNew: boolean) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const query = q.trim().toLowerCase()
  const mine = dishes.filter((d) => !query || d.name.toLowerCase().includes(query))
  const have = new Set(dishes.map((d) => d.name.toLowerCase()))
  const ideas = STARTER_DISHES.filter((s) => !have.has(s.name.toLowerCase()) && (!query || s.name.toLowerCase().includes(query)))
  const exact = dishes.some((d) => d.name.toLowerCase() === query) || STARTER_DISHES.some((s) => s.name.toLowerCase() === query)

  async function create(name: string, ingredients: string[], isNew: boolean) {
    if (!supabase || busy) return
    setBusy(true)
    const { data, error } = await supabase.from('dishes').insert({ name, ingredients }).select().single()
    setBusy(false)
    if (!error && data) onPick(data as Dish, isNew)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!query) return
    const mineHit = dishes.find((d) => d.name.toLowerCase() === query)
    if (mineHit) return onPick(mineHit, false)
    const idea = STARTER_DISHES.find((s) => s.name.toLowerCase() === query)
    void create(idea?.name ?? q.trim(), idea?.ingredients ?? [], !idea)
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <input id="dish-search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or type a dish, e.g. dosa"
          className="w-full rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg font-bold" />
      </form>
      {query && !exact && (
        <button type="button" onClick={() => void create(q.trim(), [], true)} disabled={busy}
          className="flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-left font-extrabold text-white"><Plus aria-hidden="true" />Add "{q.trim()}" as a new dish</button>
      )}
      {mine.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-extrabold uppercase tracking-[0.08em] text-faint">Your dishes</span>
          <div className="flex flex-wrap gap-2">
            {mine.map((d) => <button key={d.id} type="button" onClick={() => onPick(d, false)} className="rounded-full bg-white px-4 py-2 font-extrabold">{d.name}</button>)}
          </div>
        </div>
      )}
      {ideas.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-extrabold uppercase tracking-[0.08em] text-faint">Ideas (ingredients filled in for you)</span>
          <div className="flex flex-wrap gap-2">
            {ideas.map((s) => <button key={s.name} type="button" disabled={busy} onClick={() => void create(s.name, s.ingredients, false)} className="rounded-full border-2 border-line bg-white px-4 py-2 font-bold text-ink-2">{s.name}</button>)}
          </div>
        </div>
      )}
    </Sheet>
  )
}

function MealSheet({ meal, dish, onClose, onEdit, onRemove }: { meal: Meal; dish: Dish | null; onClose: () => void; onEdit: (d: Dish) => void; onRemove: () => void }) {
  return (
    <Sheet title={meal.title} onClose={onClose}>
      {dish?.ingredients.length ? (
        <ul className="flex flex-wrap gap-2">
          {dish.ingredients.map((i) => <li key={i} className="rounded-full bg-white px-3 py-1.5 font-bold text-ink-2">{i}</li>)}
        </ul>
      ) : <p className="font-bold text-muted">No ingredients yet. Add them so this dish goes on the shopping list.</p>}
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={onRemove} className="flex items-center gap-2 rounded-full border-2 border-line px-4 py-2.5 font-extrabold text-ink-2"><Trash2 size={18} aria-hidden="true" />Take off this day</button>
        {dish && <button type="button" onClick={() => onEdit(dish)} className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 font-extrabold text-white"><Pencil size={18} aria-hidden="true" />Edit ingredients</button>}
      </div>
    </Sheet>
  )
}

function DishEditor({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  const [name, setName] = useState(dish.name)
  const [text, setText] = useState(dish.ingredients.join('\n'))
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save() {
    if (!supabase || !name.trim()) return
    const ingredients = text.split('\n').map((s) => s.trim()).filter(Boolean)
    const { error: e } = await supabase.from('dishes').update({ name: name.trim(), ingredients }).eq('id', dish.id)
    if (e) { setError(e.message.includes('duplicate') ? 'You already have a dish with that name.' : e.message); return }
    if (name.trim() !== dish.name) await supabase.from('meal_plan').update({ title: name.trim() }).eq('dish_id', dish.id)
    onClose()
  }

  return (
    <Sheet title="Dish" onClose={onClose}>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold text-muted">Name</span>
        <input id="dish-name" value={name} onChange={(e) => setName(e.target.value)} className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg font-bold" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-extrabold text-muted">Ingredients, one per line (amounts are optional)</span>
        <textarea id="dish-ingredients" autoFocus={!dish.ingredients.length} value={text} onChange={(e) => setText(e.target.value)} rows={8}
          placeholder={'2 onions\ntomatoes\ntoor dal\ncoriander'} className="rounded-2xl border-2 border-line bg-white px-4 py-3 text-lg font-bold leading-relaxed" />
      </label>
      {error && <p className="font-bold text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-between gap-2">
        {confirmDelete
          ? <button type="button" onClick={async () => { await supabase?.from('dishes').delete().eq('id', dish.id); onClose() }} className="rounded-full bg-red-700 px-4 py-2.5 font-extrabold text-white">Delete dish and its meals</button>
          : <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 rounded-full border-2 border-line px-4 py-2.5 font-extrabold text-ink-2"><Trash2 size={18} aria-hidden="true" />Delete dish</button>}
        <button type="button" onClick={() => void save()} disabled={!name.trim()} className="rounded-full bg-amber px-6 py-2.5 font-extrabold disabled:opacity-40">Save</button>
      </div>
    </Sheet>
  )
}

/** Everything the week's meals need: tick what you already have; the rest goes on the shopping list. */
function ShoppingReview({ meals, dishes, lists, items, pantry, forecasts, weekLabel, onClose, onEditDish }: {
  meals: Meal[]; dishes: Dish[]; lists: List[]; items: ListItem[]; pantry: PantryItem[]; forecasts: Forecast[]; weekLabel: string; onClose: () => void; onEditDish: (d: Dish) => void
}) {
  const grocery = lists.find((l) => l.kind === 'grocery') ?? lists[0] ?? null
  const openTexts = useMemo(() => items.filter((i) => i.list_id === grocery?.id && !i.done).map((i) => i.text), [items, grocery])
  const needed = useMemo(() => shoppingFor(meals, dishes), [meals, dishes])
  // Start from what we know is at home: stocked pantry items (not running low) and everyday staples
  const stocked = useMemo(() => {
    const fc = new Map(forecasts.map((f) => [f.key, f]))
    return new Map(pantry.map((p) => [p.key, p.level !== 'out' && !runningLow(p, fc.get(p.key), 5)]))
  }, [pantry, forecasts])
  const [have, setHave] = useState<Set<string>>(() => new Set(needed.filter((n) =>
    stocked.has(n.key) ? stocked.get(n.key) : PANTRY_STAPLES.has(n.name) || PANTRY_STAPLES.has(n.key)).map((n) => n.key)))
  const [done, setDone] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const bare = [...new Map(meals.filter((m) => { const d = dishes.find((x) => x.id === m.dish_id); return !d?.ingredients.length }).map((m) => [m.dish_id ?? m.title, m])).values()]

  const already = needed.filter((n) => onList(n, openTexts))
  const toBuy = needed.filter((n) => !have.has(n.key) && !onList(n, openTexts))

  async function add() {
    if (!supabase || !grocery || !toBuy.length) return
    setBusy(true)
    const rows = toBuy.map((n) => ({ list_id: grocery.id, text: n.name[0].toUpperCase() + n.name.slice(1), category: grocery.kind === 'grocery' ? categorise(n.name) : null }))
    const { error } = await supabase.from('list_items').insert(rows)
    setBusy(false)
    if (!error) setDone(rows.length)
  }

  const toggle = (n: Needed) => setHave((h) => { const x = new Set(h); if (x.has(n.key)) x.delete(n.key); else x.add(n.key); return x })

  if (done !== null) {
    return (
      <Sheet title="Shopping list ready" onClose={onClose}>
        <p className="text-xl font-extrabold">Added {done} item{done === 1 ? '' : 's'} to the {grocery?.name ?? 'shopping'} list.</p>
        <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-full bg-amber px-6 py-3 font-extrabold">Done</button></div>
      </Sheet>
    )
  }

  return (
    <Sheet title={`Shopping for ${weekLabel}`} onClose={onClose}>
      {!grocery && <p className="font-bold text-red-700">Make a list in Lists first, then come back.</p>}
      <p className="font-bold text-muted">Things already at home are set to Have it. Tap to change. The rest goes on the {grocery?.name ?? 'shopping'} list.</p>

      {bare.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-amber/20 p-3">
          <span className="font-extrabold">These have no ingredients yet:</span>
          <div className="flex flex-wrap gap-2">
            {bare.map((m) => { const d = dishes.find((x) => x.id === m.dish_id); return d ? (
              <button key={m.id} type="button" onClick={() => onEditDish(d)} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-extrabold"><Pencil size={14} aria-hidden="true" />{m.title}</button>
            ) : null })}
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {needed.filter((n) => !onList(n, openTexts)).map((n) => {
          const got = have.has(n.key)
          return (
            <li key={n.key}>
              <button type="button" onClick={() => toggle(n)} aria-pressed={!got}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left ${got ? 'bg-white/60' : 'bg-white'}`}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={`text-lg font-extrabold first-letter:uppercase ${got ? 'text-muted line-through' : ''}`}>{n.name}</span>
                  <span className="truncate text-sm font-bold text-faint">{n.meals.join(', ')}{stocked.has(n.key) ? (stocked.get(n.key) ? ' · at home' : ' · running low at home') : ''}</span>
                </span>
                <span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-extrabold ${got ? 'bg-cream text-muted' : 'bg-amber text-ink'}`}>{got ? 'Have it' : 'Need it'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {already.length > 0 && <p className="text-sm font-bold text-muted">Already on the list: {already.map((n) => n.name).join(', ')}.</p>}

      <div className="sticky bottom-0 flex justify-end bg-cream pt-2">
        <button type="button" onClick={() => void add()} disabled={!grocery || !toBuy.length || busy}
          className="rounded-full bg-amber px-6 py-3 text-lg font-extrabold disabled:opacity-40">
          {busy ? 'Adding…' : toBuy.length ? `Add ${toBuy.length} to the list` : 'Nothing to add'}
        </button>
      </div>
    </Sheet>
  )
}

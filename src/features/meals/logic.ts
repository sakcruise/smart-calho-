// Pure helpers for the weekly menu: dates of a week, and turning a week of meals into one shopping list.

export type Slot = 'breakfast' | 'lunch' | 'dinner'
export const SLOTS: { id: Slot; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
]

export interface Dish { id: string; name: string; ingredients: string[] }
export interface Meal { id: string; date: string; slot: Slot; dish_id: string | null; title: string }

const pad = (n: number) => String(n).padStart(2, '0')
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Monday of the week containing d, shifted by `weeks`. */
export function weekStart(d = new Date(), weeks = 0): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + weeks * 7)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

export function weekDays(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
}

const UNITS = '(?:g|kg|gm|grams?|ml|l|litres?|liters?|tsp|tbsp|teaspoons?|tablespoons?|cups?|cloves?|pinch(?:es)?|handfuls?|bunch(?:es)?|packs?|packets?|tins?|cans?|pieces?|pcs|slices?|large|small|medium)'
const QTY = new RegExp(`^\\s*(?:[\\d½¼¾⅓⅔.,/\\-]+|a few|some|an|a)\\s*(?:${UNITS}\\.?)?\\s+(?:of\\s+)?`, 'i')

/** "2 large onions, chopped" → "onions"; "500g chicken" → "chicken". */
export function ingredientName(line: string): string {
  let s = line.toLowerCase().replace(/\(.*?\)/g, '').split(',')[0].trim()
  s = s.replace(/^(\d+)\s*(g|kg|ml|l)\b/, '').trim()
  s = s.replace(QTY, '').trim()
  s = s.replace(/\b(finely|roughly|to taste|optional)\b/g, '').replace(/\s+/g, ' ').trim()
  return s
}

/** Merge singular/plural so "onion" and "onions" become one line. */
export function sameKey(name: string): string {
  return name.replace(/(oes|ies|es|s)$/, (m) => (m === 'ies' ? 'y' : m === 'oes' ? 'o' : '')).replace(/\s+/g, ' ')
}

export interface Needed { key: string; name: string; meals: string[] }

/** Every ingredient the week's meals need, once each, with the meals that use it. */
export function shoppingFor(meals: Meal[], dishes: Dish[]): Needed[] {
  const byId = new Map(dishes.map((d) => [d.id, d]))
  const out = new Map<string, Needed>()
  for (const m of meals) {
    const dish = m.dish_id ? byId.get(m.dish_id) : undefined
    for (const line of dish?.ingredients ?? []) {
      const name = ingredientName(line)
      if (!name) continue
      const key = sameKey(name)
      const n = out.get(key) ?? { key, name, meals: [] }
      if (!n.meals.includes(m.title)) n.meals.push(m.title)
      out.set(key, n)
    }
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Is this already on the shopping list (not ticked off)? */
export function onList(n: Needed, listTexts: string[]): boolean {
  return listTexts.some((t) => sameKey(ingredientName(t)) === n.key)
}

// ---- Pantry ----

export type Level = 'full' | 'half' | 'low' | 'out'
export const LEVELS: Level[] = ['full', 'half', 'low', 'out']
export interface PantryItem { id: string; name: string; key: string; level: Level; last_bought_at: string | null }
export interface Forecast { key: string; times_bought: number; last_bought_at: string; avg_days: number | null }

/** Same key the database uses for pantry items ("2 kg Onions" → "onion"). */
export const pantryKey = (text: string) => sameKey(ingredientName(text))

/** When it will probably run out, from how often it's bought. Null until it's been bought twice. */
export function runsOutAt(item: PantryItem, f: Forecast | undefined): Date | null {
  if (!f?.avg_days || !item.last_bought_at) return null
  return new Date(Date.parse(item.last_bought_at) + f.avg_days * 86400000)
}

/** Low, out, or expected to run out within `days`. */
export function runningLow(item: PantryItem, f: Forecast | undefined, days = 3, now = Date.now()): boolean {
  if (item.level === 'low' || item.level === 'out') return true
  const at = runsOutAt(item, f)
  return !!at && at.getTime() <= now + days * 86400000
}

import { useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../lib/useTable'
import type { FamilyMember, List, ListItem } from '../../lib/types'
import { CATEGORY_ORDER, categorise } from './categories'
import { Reminders } from '../reminders/Reminders'
import { useReminders } from '../reminders/useReminders'

export function Lists({ members, activeMember }: { members: FamilyMember[]; activeMember: FamilyMember | null }) {
  const { rows: lists } = useTable<List>('lists', 'sort_order')
  const { rows: items } = useTable<ListItem>('list_items', 'created_at')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [newListName, setNewListName] = useState('')
  const [addingList, setAddingList] = useState(false)
  const { due, upcoming } = useReminders()
  const showReminders = selectedId === 'reminders'

  const selected = showReminders ? null : (lists.find((l) => l.id === selectedId) ?? lists[0] ?? null)
  const selectedItems = useMemo(() => items.filter((i) => i.list_id === selected?.id), [items, selected])
  const openCount = (listId: string) => items.filter((i) => i.list_id === listId && !i.done).length

  const grouped = useMemo(() => {
    const map = new Map<string, ListItem[]>()
    for (const it of selectedItems) {
      const key = selected?.kind === 'grocery' ? (it.category ?? 'Other') : 'Items'
      map.set(key, [...(map.get(key) ?? []), it])
    }
    const keys = [...map.keys()].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))
    return keys.map((k) => [k, map.get(k)!] as const)
  }, [selectedItems, selected])

  const lastAdded = useMemo(() => {
    const it = [...selectedItems].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    if (!it) return null
    const who = members.find((m) => m.id === it.added_by)?.name ?? 'someone'
    return `Last added by ${who} · ${timeAgo(it.created_at)}`
  }, [selectedItems, members])

  async function addItem(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!supabase || !selected || !t) return
    setText('')
    await supabase.from('list_items').insert({
      list_id: selected.id,
      text: t,
      category: selected.kind === 'grocery' ? categorise(t) : null,
      added_by: activeMember?.id ?? null,
    })
  }

  async function toggle(it: ListItem) {
    if (!supabase) return
    await supabase.from('list_items').update({ done: !it.done, done_at: it.done ? null : new Date().toISOString() }).eq('id', it.id)
  }

  async function clearDone() {
    if (!supabase || !selected) return
    await supabase.from('list_items').delete().eq('list_id', selected.id).eq('done', true)
  }

  async function createList(e: FormEvent) {
    e.preventDefault()
    const n = newListName.trim()
    if (!supabase || !n) return
    const { data } = await supabase.from('lists').insert({ name: n, kind: 'generic', sort_order: lists.length }).select().single()
    setNewListName(''); setAddingList(false)
    if (data) setSelectedId((data as List).id)
  }

  return (
    <div className="flex h-full min-h-0 gap-6 p-10 pb-6">
      <aside className="flex w-[340px] shrink-0 flex-col gap-3">
        <h1 className="mb-2 text-4xl font-black">Lists</h1>
        <button type="button" onClick={() => setSelectedId('reminders')}
          className={`flex items-center justify-between rounded-[22px] px-6 py-5 text-left ${showReminders ? 'bg-ink text-white' : 'bg-[#FFF3D6] text-ink'}`}>
          <span className="text-2xl font-extrabold">Reminders</span>
          <span className={`rounded-full px-3 py-1 text-lg font-extrabold ${showReminders ? 'bg-amber text-ink' : 'bg-white'}`}>{due.length + upcoming.length}</span>
        </button>
        {lists.map((l) => {
          const active = l.id === selected?.id
          return (
            <button key={l.id} type="button" onClick={() => setSelectedId(l.id)}
              className={`flex items-center justify-between rounded-[22px] px-6 py-5 text-left ${active ? 'bg-ink text-white' : 'bg-white text-ink'}`}>
              <span className="text-2xl font-extrabold">{l.name}</span>
              <span className={`rounded-full px-3 py-1 text-lg font-extrabold ${active ? 'bg-amber text-ink' : 'bg-sand'}`}>{openCount(l.id)}</span>
            </button>
          )
        })}
        {addingList ? (
          <form onSubmit={createList} className="flex gap-2">
            <input id="new-list" autoFocus value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="List name"
              className="min-w-0 flex-1 rounded-[22px] border-2 border-line bg-white px-5 py-4 text-xl font-bold" />
            <button type="submit" className="rounded-[22px] bg-amber px-5 font-extrabold">Add</button>
          </form>
        ) : (
          <button type="button" onClick={() => setAddingList(true)}
            className="mt-2 rounded-[22px] border-2 border-dashed border-line px-6 py-4 text-left text-xl font-extrabold text-muted">+ New list</button>
        )}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-5 rounded-[32px] bg-white p-9">
        {showReminders ? (
          <Reminders members={members} />
        ) : selected ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-4xl font-black">{selected.name}</h2>
              <button type="button" onClick={clearDone} disabled={!selectedItems.some((i) => i.done)}
                className="rounded-full border-2 border-line px-6 py-3 text-xl font-extrabold text-ink-2 disabled:opacity-40">Clear ticked</button>
            </div>
            <form onSubmit={addItem} className="flex gap-3">
              <label htmlFor="new-item" className="sr-only">Add an item</label>
              <input id="new-item" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off"
                placeholder={selected.kind === 'grocery' ? 'Add an item… e.g. bananas' : 'Add an item…'}
                className="min-w-0 flex-1 rounded-[20px] border-2 border-line bg-cream px-6 py-4 text-2xl font-bold" />
              <button type="submit" disabled={!text.trim()} className="rounded-[20px] bg-amber px-8 text-2xl font-extrabold disabled:opacity-40">Add</button>
            </form>
            <div className="min-h-0 flex-1 overflow-auto">
              {grouped.length === 0 && <p className="py-6 text-xl font-bold text-faint">Nothing on this list yet.</p>}
              <div className={`grid gap-6 ${selected.kind === 'grocery' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                {grouped.map(([cat, its]) => (
                  <div key={cat} className="flex min-w-0 flex-col gap-2.5">
                    {selected.kind === 'grocery' && <h3 className="text-base font-extrabold uppercase tracking-[0.08em] text-faint">{cat}</h3>}
                    {its.map((it) => (
                      <label key={it.id} className={`flex cursor-pointer items-center gap-3.5 rounded-[18px] bg-cream px-4 py-4 text-2xl font-bold ${it.done ? 'text-faint line-through' : ''}`}>
                        <input type="checkbox" checked={it.done} onChange={() => void toggle(it)} className="h-8 w-8 shrink-0 accent-green-600" />
                        <span className="min-w-0 flex-1 break-words">{it.text}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {lastAdded && <p className="text-lg font-bold text-faint">{lastAdded}</p>}
          </>
        ) : (
          <p className="text-xl font-bold text-faint">Create a list to get started.</p>
        )}
      </section>
    </div>
  )
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} h ago`
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

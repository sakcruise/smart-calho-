import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { householdId } from '../../lib/household'
import { todayKey, type FamilyMember, type Reward, type StarEntry, type Task, type TaskCompletion } from '../../lib/types'
import { streaks } from './streaks'

export interface Badge { id: string; label: string; detail: string; earned: boolean }

export interface MemberStars {
  balance: number
  lifetime: number
  goal: Reward | null
  goalReady: boolean
  /** Surprises not yet earned: only the nearest milestone is shown, never the name. */
  nextSurpriseAt: number | null
  /** Earned but not opened: the child taps the wrapped box. */
  unopened: Reward[]
  opened: Reward[]
  claimedGoals: Reward[]
  streak: number
  bestStreak: number
  badges: Badge[]
  history: StarEntry[]
}

function badgesFor(lifetime: number, best: number, rewardsClaimed: number): Badge[] {
  const out: Badge[] = []
  for (const n of [3, 7, 14, 30]) out.push({ id: `streak-${n}`, label: `${n}-day streak`, detail: `Every task done ${n} days running`, earned: best >= n })
  for (const n of [10, 50, 100, 250, 500]) out.push({ id: `stars-${n}`, label: `${n} stars`, detail: `Earned ${n} stars in total`, earned: lifetime >= n })
  for (const n of [1, 5]) out.push({ id: `rewards-${n}`, label: n === 1 ? 'First reward' : `${n} rewards`, detail: n === 1 ? 'Reached a reward goal' : `Reached ${n} reward goals`, earned: rewardsClaimed >= n })
  return out
}

/** Everything about stars and rewards, live. */
export function useRewards(members: FamilyMember[]) {
  const [rewards, setRewards] = useState<Reward[]>([])
  const [ledger, setLedger] = useState<StarEntry[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [completions, setCompletions] = useState<TaskCompletion[]>([])

  const loadRewards = useCallback(async () => {
    const { data } = await supabase!.from('rewards').select('*').order('created_at')
    setRewards((data as Reward[]) ?? [])
  }, [])
  const loadLedger = useCallback(async () => {
    const { data } = await supabase!.from('star_ledger').select('*').order('created_at', { ascending: false })
    setLedger((data as StarEntry[]) ?? [])
  }, [])
  const loadHistory = useCallback(async () => {
    const since = new Date(); since.setDate(since.getDate() - 90)
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase!.from('tasks').select('*'),
      supabase!.from('task_completions').select('*').gte('date', todayKey(since)),
    ])
    setTasks((t as Task[]) ?? [])
    setCompletions((c as TaskCompletion[]) ?? [])
  }, [])

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    void loadRewards(); void loadLedger(); void loadHistory()
    const channel = client
      .channel(`rewards:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rewards' }, () => void loadRewards())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'star_ledger' }, () => void loadLedger())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, () => void loadHistory())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => void loadHistory())
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [loadRewards, loadLedger, loadHistory])

  const byMember = useMemo(() => {
    const out: Record<string, MemberStars> = {}
    for (const m of members) {
      const mine = ledger.filter((e) => e.member_id === m.id)
      const balance = Math.max(0, mine.reduce((a, e) => a + e.delta, 0))
      const lifetime = mine.filter((e) => e.delta > 0).reduce((a, e) => a + e.delta, 0)
      const theirs = rewards.filter((r) => r.member_id === m.id)
      const goal = theirs.find((r) => !r.is_surprise && !r.claimed_at) ?? null
      const claimedGoals = theirs.filter((r) => !r.is_surprise && r.claimed_at)
      const surprises = theirs.filter((r) => r.is_surprise)
      const locked = surprises.filter((r) => !r.unlocked_at && lifetime < r.star_target).sort((a, b) => a.star_target - b.star_target)
      const s = streaks(tasks, completions, m.id)
      out[m.id] = {
        balance, lifetime, goal, goalReady: !!goal && balance >= goal.star_target,
        nextSurpriseAt: locked[0]?.star_target ?? null,
        unopened: surprises.filter((r) => (r.unlocked_at || lifetime >= r.star_target) && !r.claimed_at),
        opened: surprises.filter((r) => r.claimed_at),
        claimedGoals,
        streak: s.current, bestStreak: s.best,
        badges: badgesFor(lifetime, s.best, claimedGoals.length),
        history: mine,
      }
    }
    return out
  }, [members, ledger, rewards, tasks, completions])

  // Mark surprises unlocked the moment their milestone is reached (idempotent across screens)
  useEffect(() => {
    if (!supabase) return
    for (const m of members) {
      const info = byMember[m.id]
      if (!info) continue
      for (const r of info.unopened.filter((x) => !x.unlocked_at)) {
        void supabase.from('rewards').update({ unlocked_at: new Date().toISOString() }).eq('id', r.id).is('unlocked_at', null)
      }
    }
  }, [byMember, members])

  async function saveGoal(memberId: string, goal: { id?: string; name: string; icon: string; image_path: string | null; star_target: number }) {
    if (!supabase) return
    const row = { name: goal.name, icon: goal.icon, image_path: goal.image_path, star_target: goal.star_target }
    if (goal.id) await supabase.from('rewards').update(row).eq('id', goal.id)
    else await supabase.from('rewards').insert({ ...row, member_id: memberId, is_surprise: false })
  }

  /** Hand over a goal: spend its stars and mark it claimed. */
  async function claimGoal(goal: Reward) {
    if (!supabase) return
    await supabase.from('star_ledger').insert({ member_id: goal.member_id, delta: -goal.star_target, reason: `Reward: ${goal.name}`, source: 'reward_claim' })
    await supabase.from('rewards').update({ claimed_at: new Date().toISOString() }).eq('id', goal.id)
  }

  /** A surprise unlocks after `afterStars` more stars than the child has earned so far. */
  async function addSurprise(memberId: string, s: { name: string; icon: string; image_path: string | null; afterStars: number }) {
    if (!supabase) return
    const lifetime = byMember[memberId]?.lifetime ?? 0
    await supabase.from('rewards').insert({ member_id: memberId, name: s.name, icon: s.icon, image_path: s.image_path, star_target: lifetime + s.afterStars, is_surprise: true })
  }

  async function openSurprise(r: Reward) {
    await supabase?.from('rewards').update({ claimed_at: new Date().toISOString(), unlocked_at: r.unlocked_at ?? new Date().toISOString() }).eq('id', r.id)
  }

  async function deleteReward(r: Reward) {
    await supabase?.from('rewards').delete().eq('id', r.id)
  }

  /** Manual bonus or deduction. A deduction never takes the balance below zero. */
  async function adjust(memberId: string, delta: number, reason: string) {
    if (!supabase || delta === 0) return
    const balance = byMember[memberId]?.balance ?? 0
    const d = delta < 0 ? Math.max(delta, -balance) : delta
    if (d === 0) return
    await supabase.from('star_ledger').insert({ member_id: memberId, delta: d, reason: reason || (d > 0 ? 'Bonus from a grown-up' : 'Taken back'), source: 'manual' })
  }

  return { byMember, rewards, saveGoal, claimGoal, addSurprise, openSurprise, deleteReward, adjust }
}

/** Signed URL for a private photo in the photos bucket; refreshes hourly. */
export function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!supabase || !path) { setUrl(null); return }
    let cancelled = false
    const load = async () => {
      const { data } = await supabase!.storage.from('photos').createSignedUrl(path, 3600)
      if (!cancelled) setUrl(data?.signedUrl ?? null)
    }
    void load()
    const id = setInterval(() => void load(), 50 * 60 * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [path])
  return url
}

export async function uploadRewardPhoto(file: File): Promise<string | null> {
  if (!supabase) return null
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const hh = await householdId()
  if (!hh) return null
  const path = `${hh}/rewards/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('photos').upload(path, file, { contentType: file.type, upsert: false })
  return error ? null : path
}

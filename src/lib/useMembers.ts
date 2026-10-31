import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { cacheGet, cacheSet } from './cache'
import type { FamilyMember } from './types'

/** Family members, kept live through Supabase Realtime. */
export function useMembers() {
  const [members, setMembers] = useState<FamilyMember[]>(() => cacheGet<FamilyMember[]>('members') ?? [])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    const load = async () => {
      const { data, error } = await client.from('family_members').select('*').order('sort_order')
      if (!error) { setMembers((data as FamilyMember[]) ?? []); cacheSet('members', data) }
      setLoading(false)
    }
    void load()
    const channel = client
      .channel(`family_members:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members' }, () => void load())
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [])

  return { members, loading }
}

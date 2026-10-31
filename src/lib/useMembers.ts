import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { FamilyMember } from './types'

/** Family members, kept live through Supabase Realtime. */
export function useMembers() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    const load = async () => {
      const { data } = await client.from('family_members').select('*').order('sort_order')
      setMembers((data as FamilyMember[]) ?? [])
      setLoading(false)
    }
    void load()
    const channel = client
      .channel('family_members')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members' }, () => void load())
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [])

  return { members, loading }
}

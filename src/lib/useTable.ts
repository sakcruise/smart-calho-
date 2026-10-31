import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/** Rows of one table, reloaded on any Realtime change. */
export function useTable<T>(table: string, orderBy: string, ascending = true) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const client = supabase
    const load = async () => {
      const { data } = await client.from(table).select('*').order(orderBy, { ascending })
      setRows((data as T[]) ?? [])
      setLoading(false)
    }
    void load()
    const channel = client
      .channel(`table:${table}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => void load())
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [table, orderBy, ascending])

  return { rows, loading }
}

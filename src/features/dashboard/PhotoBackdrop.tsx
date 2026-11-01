import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useTable } from '../../lib/useTable'

interface Photo { id: string; storage_path: string; created_at: string }

export const PHOTO_SECONDS = 30

// Free-to-use landscape photos (Unsplash licence) that roll when the family hasn't added many of their own
const SCENIC = [
  '1464822759023-fed622ff2c3b', // snow-capped mountains, valley and forest
  '1501785888041-af3ef285b470', // wooden boats on a blue lake
  '1506744038136-46273834b3fb', // river through Yosemite valley
  '1470770841072-f978cf4d019e', // house by the water
  '1532274402911-5a369e4c4bb5', // path through purple flowers to a pier
  '1469474968028-56623f02e42e', // sun rays over mountains
  '1506260408121-e353d10b87c7', // green hills under clouds
  '1472214103451-9374bd1c798e', // grass field at sunset
  '1519681393784-d120267933ba', // snowy mountain under stars
  '1498429089284-41f8cf3ffd39', // Yosemite waterfall
  '1511884642898-4c92249e20b6', // forest from above
  '1727331000865-b5085a18463b', // sunset over green hills
]
export const SCENIC_URLS = SCENIC.map((id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1920&q=80`)

/** Family photos (signed URLs, refreshed hourly), topped up with scenic ones when there are only a few. Shuffled once per load. */
export function usePhotoUrls() {
  const family = useFamilyPhotoUrls()
  const scenic = useMemo(() => [...SCENIC_URLS].sort(() => Math.random() - 0.5), [])
  return useMemo(() => (family.length >= 6 ? family : [...family, ...scenic]), [family, scenic])
}

function useFamilyPhotoUrls() {
  const { rows } = useTable<Photo>('photos', 'created_at', false)
  const [urls, setUrls] = useState<string[]>([])
  const paths = useMemo(() => rows.map((r) => r.storage_path).sort(() => Math.random() - 0.5), [rows])
  useEffect(() => {
    if (!supabase || paths.length === 0) { setUrls([]); return }
    let cancelled = false
    const load = async () => {
      const { data } = await supabase!.storage.from('photos').createSignedUrls(paths, 3600)
      if (!cancelled) setUrls((data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[])
    }
    void load()
    const id = setInterval(() => void load(), 50 * 60 * 1000)
    return () => { cancelled = true; clearInterval(id) }
  }, [paths])
  return urls
}

/** Family photos filling their container, a new one every 30 seconds with a slow pan and zoom. */
export function PhotoBackdrop({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (urls.length < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % urls.length), PHOTO_SECONDS * 1000)
    return () => clearInterval(id)
  }, [urls.length])

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes fsc-kb-a { from { transform: scale(1.02) translate(0,0) } to { transform: scale(1.14) translate(-2.5%, -1.5%) } }
        @keyframes fsc-kb-b { from { transform: scale(1.14) translate(2%, 1%) } to { transform: scale(1.02) translate(0,0) } }
        @media (prefers-reduced-motion: reduce) { .fsc-kb { animation: none !important } }
      `}</style>
      {urls.map((u, i) => (
        <img key={u} src={u} alt="" className="fsc-kb absolute inset-0 h-full w-full object-cover transition-opacity duration-[2000ms]"
          style={{ opacity: i === index ? 1 : 0, animation: i === index ? `${index % 2 ? 'fsc-kb-b' : 'fsc-kb-a'} ${PHOTO_SECONDS + 2}s ease-in-out forwards` : 'none' }} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />
    </div>
  )
}

import { useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { householdId } from '../../lib/household'
import { useTable } from '../../lib/useTable'
import { useSignedUrl } from '../rewards/useRewards'

interface Photo { id: string; storage_path: string; created_at: string }

/** Upload and remove the family photos that roll on the idle screen. */
export function PhotosAdmin() {
  const { rows: photos } = useTable<Photo>('photos', 'created_at', false)
  const [busy, setBusy] = useState<string | null>(null)

  async function upload(files: FileList | null) {
    if (!supabase || !files?.length) return
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    let done = 0, failed = 0
    const hh = await householdId()
    if (!hh) { setBusy("Couldn't upload: check the internet and try again."); return }
    for (const f of list) {
      setBusy(`Uploading ${done + 1} of ${list.length}…`)
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${hh}/family/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('photos').upload(path, f, { contentType: f.type })
      if (error) { failed++; continue }
      await supabase.from('photos').insert({ storage_path: path })
      done++
    }
    setBusy(failed ? `${done} added, ${failed} didn't upload (try smaller files).` : null)
  }

  async function remove(p: Photo) {
    if (!supabase) return
    await supabase.storage.from('photos').remove([p.storage_path])
    await supabase.from('photos').delete().eq('id', p.id)
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h2 className="text-2xl font-black lg:text-3xl">Photos</h2>
          <p className="font-bold text-muted">These roll on the wall when nobody has touched it for a while.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-full bg-amber px-5 py-3 font-extrabold">
          <ImagePlus aria-hidden="true" size={20} />Add photos
          <input id="photo-upload" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void upload(e.target.files)} />
        </label>
      </div>
      {busy && <p className="rounded-2xl bg-white px-4 py-3 font-bold">{busy}</p>}
      {photos.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-line p-5 font-bold text-muted">No photos yet. Add some from your phone; landscape photos fill the wall best.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((p) => <Thumb key={p.id} photo={p} onDelete={() => void remove(p)} />)}
        </div>
      )}
    </section>
  )
}

function Thumb({ photo, onDelete }: { photo: Photo; onDelete: () => void }) {
  const url = useSignedUrl(photo.storage_path)
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <button type="button" onClick={() => (confirm ? onDelete() : setConfirm(true))} aria-label={confirm ? 'Confirm delete photo' : 'Delete photo'}
        className={`absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-extrabold ${confirm ? 'bg-red-700 text-white' : 'bg-white/90 text-ink-2'}`}>
        <Trash2 size={16} aria-hidden="true" />{confirm ? 'Delete' : ''}
      </button>
    </div>
  )
}

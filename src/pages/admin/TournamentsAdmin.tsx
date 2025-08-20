import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import type { Tournament } from '../../types/db'

export default function TournamentsAdmin() {
  const [items, setItems] = useState<Tournament[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [format, setFormat] = useState<'BP'|'AP'>('BP')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; name: string; description: string; format: 'BP'|'AP' } | null>(null)

  async function load() {
  const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setItems(data as Tournament[])
  }
  useEffect(() => { load() }, [])

  async function createTournament(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // Find current app user row id (by auth uid preferred)
      const sess = await supabase.auth.getSession()
      const uid = sess.data.session?.user?.id
      const email = sess.data.session?.user?.email ?? null
      const fullName = (sess.data.session?.user?.user_metadata?.full_name || sess.data.session?.user?.user_metadata?.name || null) as string | null
      let created_by: string | null = null
      if (uid) {
        const { data: meByUid, error: meByUidErr } = await supabase.from('users').select('id').eq('auth_uid', uid).maybeSingle()
        if (meByUidErr) throw meByUidErr
        created_by = meByUid?.id ?? null
      }
      if (!created_by && email) {
        const { data: meByEmail, error: meByEmailErr } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
        if (meByEmailErr) throw meByEmailErr
        created_by = meByEmail?.id ?? null
      }

      // If still not found, upsert a profile row and fetch its id (handles first-time admin)
      if (!created_by && uid) {
        const { error: upErr } = await supabase
          .from('users')
          .upsert({ auth_uid: uid, email, full_name: fullName }, { onConflict: 'auth_uid' })
        if (upErr) throw upErr
        const { data: re, error: reErr } = await supabase.from('users').select('id').eq('auth_uid', uid).maybeSingle()
        if (reErr) throw reErr
        created_by = re?.id ?? null
      }

      const { error } = await supabase
        .from('tournaments')
        .insert({ name, description: description || null, format, created_by })
      if (error) throw error
      setName('')
      setDescription('')
      setFormat('BP')
      await load()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setLoading(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete tournament?')) return
    const { error } = await supabase.from('tournaments').delete().eq('id', id)
    if (error) alert(error.message); else load()
  }

  async function startEdit(t: Tournament) {
    setEditing({ id: t.id, name: t.name, description: (t as any).description ?? '', format: ((t as any).format ?? 'BP') as 'BP'|'AP' })
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setLoading(true); setError(null)
    try {
      const { error } = await supabase.from('tournaments')
        .update({ name: editing.name, description: editing.description || null, format: editing.format })
        .eq('id', editing.id)
      if (error) throw error
      setEditing(null)
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tournament Management</h1>
          <p className="mt-1 text-zinc-400">Create and manage debate tournaments</p>
        </div>
        <Link 
          to="/admin/tournaments/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors inline-flex items-center gap-2"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Tournament
        </Link>
      </div>

      <form onSubmit={createTournament} className="mb-4 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <label className="block text-sm text-zinc-300" htmlFor="name">Name</label>
          <input id="name" value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm text-zinc-300" htmlFor="description">Description</label>
          <textarea id="description" value={description} onChange={e=>setDescription(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label className="block text-sm text-zinc-300">Format</label>
          <select value={format} onChange={e=>setFormat(e.target.value as 'BP'|'AP')} className="w-max rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
            <option value="BP">BP</option>
            <option value="AP">AP</option>
          </select>
        </div>
        <button disabled={loading || !name} className="w-max rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">{loading? 'Creating…':'Create'}</button>
        {error && <p className="text-sm text-rose-400">Error: {error}</p>}
      </form>

      {editing && (
        <form onSubmit={saveEdit} className="mb-4 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-sm text-zinc-300">Editing tournament</div>
          <div>
            <label className="block text-sm text-zinc-300">Name</label>
            <input value={editing.name} onChange={e=>setEditing({ ...editing, name: e.target.value })} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div>
            <label className="block text-sm text-zinc-300">Description</label>
            <textarea value={editing.description} onChange={e=>setEditing({ ...editing, description: e.target.value })} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div>
            <label className="block text-sm text-zinc-300">Format</label>
            <select value={editing.format} onChange={e=>setEditing({ ...editing, format: e.target.value as 'BP'|'AP' })} className="w-max rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
              <option value="BP">BP</option>
              <option value="AP">AP</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button disabled={loading} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60">Save</button>
            <button type="button" onClick={()=>setEditing(null)} className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid gap-2">
        {items.map((t) => (
          <div key={t.id} className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-white">{t.name} <span className="ml-2 rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">{(t as any).format ?? 'BP'}</span></div>
              {t.description && <div className="text-sm text-zinc-400">{t.description}</div>}
              <div className="mt-3 p-3 bg-zinc-800/50 rounded-md border border-zinc-700">
                <div className="text-xs text-zinc-300 mb-2 font-medium">🛠️ Manage Tournament:</div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Link className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-white transition-colors" to={`/admin/tournament/${t.slug}`}>
                    🏠 Dashboard
                  </Link>
                  <Link className="inline-flex items-center gap-1 rounded-md bg-green-600 hover:bg-green-500 px-3 py-1.5 text-white transition-colors" to={`/admin/tournament/${t.slug}/teams`}>
                    👥 Teams
                  </Link>
                  <Link className="inline-flex items-center gap-1 rounded-md bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-white transition-colors" to={`/tournament/${t.slug}`}>
                    👁️ Public View
                  </Link>
                </div>
                <div className="mt-2 text-xs text-zinc-400">
                  💡 Access tournament administration and public view
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>startEdit(t)} className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200">Edit</button>
              <button onClick={()=>remove(t.id)} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/20">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

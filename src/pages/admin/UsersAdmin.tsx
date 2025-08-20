import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../config/supabase'

type AppUser = {
  id: string
  email: string | null
  full_name: string | null
  is_admin: boolean | null
  auth_uid: string | null
  created_at?: string | null
}

export default function UsersAdmin() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [authUid, setAuthUid] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  function errToMessage(e: unknown): string {
    if (!e) return 'Unknown error'
    if (typeof e === 'string') return e
    if (e instanceof Error) return e.message
    // Supabase/PostgREST errors are plain objects with message/details/code
    try {
      const anyE = e as any
      if (anyE.message) return String(anyE.message)
      if (anyE.error_description) return String(anyE.error_description)
      if (anyE.error) return String(anyE.error)
      return JSON.stringify(e)
    } catch {
      return 'Unexpected error'
    }
  }

  async function load() {
    setError(null)
    const { data, error } = await supabase
      .from('users')
      .select('id,email,full_name,is_admin,auth_uid,created_at')
      .order('created_at', { ascending: false })
    if (error) setError(errToMessage(error))
    else setUsers((data as AppUser[]) || [])
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!q.trim()) return users
    const s = q.toLowerCase()
    return users.filter(u =>
      (u.email ?? '').toLowerCase().includes(s) ||
      (u.full_name ?? '').toLowerCase().includes(s) ||
      u.id.includes(s) ||
      (u.auth_uid ?? '').includes(s)
    )
  }, [q, users])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    try {
      const payload: Partial<AppUser> = {
        email: email.trim() || null,
        full_name: fullName.trim() || null,
        auth_uid: authUid.trim() || null,
        is_admin: isAdmin,
      }
      const { error } = await supabase.from('users').insert(payload)
      if (error) throw error
      setEmail(''); setFullName(''); setAuthUid(''); setIsAdmin(false)
      await load()
    } catch (e) {
      setError(errToMessage(e))
    } finally {
      setLoading(false)
    }
  }

  async function updateUser(id: string, patch: Partial<AppUser>) {
    const { error } = await supabase.from('users').update(patch).eq('id', id)
    if (error) alert(error.message); else load()
  }

  async function removeUser(id: string) {
    if (!confirm('Delete user row? This may remove related data if cascades exist.')) return
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) alert(error.message); else load()
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by email, name, id, uid" className="min-w-[240px] flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
      </div>

      <form onSubmit={createUser} className="mb-4 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="text-sm text-zinc-300">Create app user (does not create Supabase auth account)</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div>
            <label className="block text-sm text-zinc-300">Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div>
            <label className="block text-sm text-zinc-300">Full Name</label>
            <input value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div>
            <label className="block text-sm text-zinc-300">Auth UID (optional)</label>
            <input value={authUid} onChange={e=>setAuthUid(e.target.value)} placeholder="auth.users.id" className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input id="is_admin" type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)} />
            <label htmlFor="is_admin" className="text-sm text-zinc-300">Is Admin</label>
          </div>
        </div>
        <button disabled={loading} className="w-max rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">{loading? 'Creating…':'Create user'}</button>
        {error && <p className="text-sm text-rose-400">Error: {error}</p>}
      </form>

      {error && (
        <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          Error: {error}
          <div className="mt-1 text-xs text-rose-200">Tip: Ensure your app user is admin under public.users and linked via auth_uid or email. Apply the RLS policies in supabase.schema.sql.</div>
        </div>
      )}
      <div className="grid gap-2">
        {filtered.map((u) => (
          <div key={u.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-white">{u.email ?? '(no email)'} {u.is_admin ? <span className="ml-2 rounded border border-emerald-600 px-1.5 py-0.5 text-xs text-emerald-300">admin</span> : null}</div>
                <div className="text-xs text-zinc-400">{u.full_name ?? ''}</div>
                <div className="text-xs text-zinc-500">id: {u.id}</div>
                <div className="text-xs text-zinc-500">uid: {u.auth_uid ?? '—'}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={()=>updateUser(u.id, { is_admin: !u.is_admin })} className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200">{u.is_admin ? 'Revoke admin' : 'Make admin'}</button>
                <button onClick={()=>removeUser(u.id)} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/20">Delete</button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <label className="block text-xs text-zinc-400">Email</label>
                <input defaultValue={u.email ?? ''} onBlur={e=>{ const v=e.target.value.trim(); if (v !== (u.email ?? '')) updateUser(u.id, { email: v || null }) }} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400">Full Name</label>
                <input defaultValue={u.full_name ?? ''} onBlur={e=>{ const v=e.target.value.trim(); if (v !== (u.full_name ?? '')) updateUser(u.id, { full_name: v || null }) }} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400">Auth UID</label>
                <input defaultValue={u.auth_uid ?? ''} onBlur={e=>{ const v=e.target.value.trim(); if (v !== (u.auth_uid ?? '')) updateUser(u.id, { auth_uid: v || null }) }} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-white outline-none" />
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-zinc-400">No users.</p>}
      </div>
    </section>
  )
}

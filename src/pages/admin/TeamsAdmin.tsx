import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../config/supabase'
import type { Team } from '../../types/db'
import { useTournamentAdmin } from './TournamentAdminScope'

export default function TeamsAdmin() {
  const { tournamentId } = useTournamentAdmin()
  const [items, setItems] = useState<Team[]>([])
  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [members, setMembers] = useState<Array<{ user_id: string; role: 'leader'|'member'|'substitute'; label?: string }>>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Simple search UI state for selecting users by full name
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [userQuery, setUserQuery] = useState('')
  const [options, setOptions] = useState<Array<{ id: string; full_name: string | null; email: string | null }>>([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const debounceRef = useRef<number | null>(null)

  function errToMessage(e: unknown): string {
    if (!e) return 'Unknown error'
    if (typeof e === 'string') return e
    if (e instanceof Error) return e.message
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

  const loadTeams = useCallback(async (tid?: string) => {
    const id = tid ?? tournamentId
    if (!id) { setItems([]); return }
    const { data, error } = await supabase.from('teams').select('id,name,institution,tournament_id').eq('tournament_id', id).order('name')
    if (error) setError(errToMessage(error))
    else setItems((data as Team[]) || [])
  }, [tournamentId])

  useEffect(() => { loadTeams() }, [tournamentId])

  async function createTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!tournamentId || !name) return
    setError(null)
    setCreating(true)
    try {
      // create team
      const { data: teamRes, error: teamErr } = await supabase
        .from('teams')
        .insert({ tournament_id: tournamentId, name, institution: institution || null })
        .select('id')
        .single()
      if (teamErr) throw teamErr
      const teamId = (teamRes as any).id as string
      // bulk insert members if provided
      const trimmed = members.filter(m => m.user_id.trim() !== '')
      if (trimmed.length > 0) {
        // Only send columns that exist in public.members
        const payload = trimmed.map(m => ({ user_id: m.user_id, role: m.role, team_id: teamId }))
        const { error: memErr } = await supabase.from('members').insert(payload)
        if (memErr) throw memErr
      }
      setName('')
      setInstitution('')
      setMembers([])
      await loadTeams()
    } catch (err) {
      setError(errToMessage(err))
    } finally {
      setCreating(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete team?')) return
    const { error } = await supabase.from('teams').delete().eq('id', id)
    if (error) alert(error.message); else loadTeams()
  }

  async function runSearch(q: string) {
    if (q.trim().length < 2) { setOptions([]); setSearchErr(null); return }
    setSearching(true); setSearchErr(null)
    const { data, error } = await supabase
      .from('users')
      .select('id,full_name,email')
      .ilike('full_name', `%${q}%`)
      .limit(10)
    setSearching(false)
  if (error) { setSearchErr(errToMessage(error)); setOptions([]); return }
    setOptions((data as any[]) as Array<{ id: string; full_name: string | null; email: string | null }>)
  }

  function onQueryChange(idx: number, q: string) {
    setActiveIdx(idx)
    setUserQuery(q)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => { runSearch(q) }, 250) as unknown as number
  }

  function chooseUser(idx: number, opt: { id: string; full_name: string | null; email: string | null }) {
    const label = opt.full_name ?? opt.email ?? opt.id
    setMembers(prev => prev.map((x,i) => i===idx ? { ...x, user_id: opt.id, label } : x))
    setUserQuery(label)
    setOptions([])
    setActiveIdx(null)
  }

  function clearUser(idx: number) {
    setMembers(prev => prev.map((x,i) => i===idx ? { ...x, user_id: '', label: '' } : x))
    if (activeIdx === idx) setUserQuery('')
  }

  return (
    <section>
      {!tournamentId && <p className="mb-3 text-sm text-amber-300">Pick a tournament at the top to manage teams.</p>}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <form onSubmit={createTeam} className="flex flex-1 flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm text-zinc-300">Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm text-zinc-300">Institution</label>
            <input value={institution} onChange={e=>setInstitution(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div className="basis-full" />
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="mb-2 text-sm text-zinc-300">Team members (optional)</div>
            {members.map((m, idx) => (
              <div key={idx} className="mb-2 w-full">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="relative min-w-[260px] flex-1">
                    <input
                      value={activeIdx === idx ? userQuery : (m.label ?? '')}
                      onFocus={()=>{ setActiveIdx(idx); setUserQuery(m.label ?? '') }}
                      onChange={e=> onQueryChange(idx, e.target.value)}
                      placeholder="Search user by full name"
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none"
                    />
                    {activeIdx === idx && (options.length > 0 || searching || searchErr) && (
                      <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-lg">
                        {searching && <div className="px-3 py-2 text-sm text-zinc-400">Searching…</div>}
                        {searchErr && <div className="px-3 py-2 text-sm text-rose-400">{searchErr}</div>}
                        {!searching && !searchErr && options.map(opt => (
                          <button type="button" key={opt.id}
                            onClick={()=> chooseUser(idx, opt)}
                            className="block w-full cursor-pointer px-3 py-2 text-left hover:bg-zinc-800">
                            <div className="text-sm text-white">{opt.full_name ?? '(no name)'}{opt.full_name && opt.email ? ' • ' : ''}{opt.email ?? ''}</div>
                            <div className="text-xs text-zinc-500">{opt.id}</div>
                          </button>
                        ))}
                        {!searching && !searchErr && options.length === 0 && userQuery.trim().length >= 2 && (
                          <div className="px-3 py-2 text-sm text-zinc-400">No matches</div>
                        )}
                      </div>
                    )}
                  </div>
                  {m.user_id && <span className="text-xs text-zinc-500">Selected: {m.label ?? m.user_id}</span>}
                  <button type="button" onClick={()=> clearUser(idx)} className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200">Clear</button>
                <select value={m.role} onChange={e=>{
                  const v = e.target.value as 'leader'|'member'|'substitute'; setMembers(prev=> prev.map((x,i)=> i===idx? { ...x, role: v }: x))
                }} className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
                  <option value="leader">leader</option>
                  <option value="member">member</option>
                  <option value="substitute">substitute</option>
                </select>
                  <button type="button" onClick={()=> setMembers(prev=> prev.filter((_,i)=> i!==idx))} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-sm text-rose-300 hover:bg-rose-500/20">Remove</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={()=> setMembers(prev=> [...prev, { user_id: '', role: 'member' }])} className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200">+ Add member</button>
          </div>
          <button disabled={!tournamentId || !name || creating} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">{creating? 'Adding…':'Add Team'}</button>
        </form>
      </div>
    {error && <p className="mb-2 text-sm text-rose-400">Error: {error}</p>}

      <div className="grid gap-2">
  {items.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div>
              <div className="font-semibold text-white">{t.name}</div>
              {t.institution && <div className="text-sm text-zinc-400">{t.institution}</div>}
            </div>
            <button onClick={()=>remove(t.id)} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/20">Delete</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-zinc-400">No teams for this tournament.</p>}
      </div>
    </section>
  )
}

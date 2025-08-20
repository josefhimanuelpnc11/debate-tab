import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import type { Team } from '../../types/db'
import { useTournamentAdmin } from './TournamentAdminScope'

type Member = { id: string; user_id: string; team_id: string; role: Role }
type Role = 'leader' | 'member' | 'substitute'
const ROLES: ReadonlyArray<Role> = ['leader', 'member', 'substitute'] as const

export default function MembersAdmin() {
  const { tournamentId } = useTournamentAdmin()
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [teamId, setTeamId] = useState('')
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadTeams(tid?: string) {
    const id = tid ?? tournamentId
    if (!id) { setTeams([]); return }
    const { data } = await supabase.from('teams').select('id,name,institution,tournament_id').eq('tournament_id', id).order('name')
    setTeams((data as Team[]) || [])
  }
  async function loadMembers(team?: string) {
    const id = team ?? teamId
    if (!id) { setMembers([]); return }
    const { data } = await supabase.from('members').select('id,user_id,team_id,role').eq('team_id', id)
    setMembers((data as Member[]) || [])
  }

  useEffect(() => { loadTeams(); setTeamId(''); setMembers([]) }, [tournamentId])
  useEffect(() => { loadMembers() }, [teamId])

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!teamId || !userId) return
    setCreating(true); setError(null)
    try {
      const { error } = await supabase
        .from('members')
        .insert({ team_id: teamId, user_id: userId, role })
      if (error) throw error
      setUserId('')
  setRole('member')
      await loadMembers()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setCreating(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete member?')) return
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) alert(error.message); else loadMembers()
  }

  return (
    <section>
  <div className="mb-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-sm text-zinc-300">Team</label>
          <select value={teamId} onChange={e=>setTeamId(e.target.value)} className="min-w-[200px] rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
            <option value="">— Choose —</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <form onSubmit={addMember} className="flex flex-1 flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm text-zinc-300">User Id (public.users.id)</label>
            <input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="users.id" className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div>
            <label className="block text-sm text-zinc-300">Role</label>
            <select value={role} onChange={e=>setRole(e.target.value as Role)} className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button disabled={!teamId || !userId || creating} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">{creating? 'Adding…':'Add Member'}</button>
        </form>
      </div>
      {error && <p className="mb-2 text-sm text-rose-400">Error: {error}</p>}

      <div className="grid gap-2">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div>
              <div className="font-semibold text-white">{m.user_id}</div>
              <div className="text-xs text-zinc-500">Role: {m.role}</div>
            </div>
            <button onClick={()=>remove(m.id)} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/20">Delete</button>
          </div>
        ))}
        {members.length === 0 && <p className="text-sm text-zinc-400">No members for this team.</p>}
      </div>
    </section>
  )
}

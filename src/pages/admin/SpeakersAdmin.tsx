import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import type { Team } from '../../types/db'
import { useTournamentAdmin } from './TournamentAdminScope'

type Speaker = { id: string; name: string; team_id: string; speaker_order: number | null }

export default function SpeakersAdmin() {
  const { tournamentId } = useTournamentAdmin()
  const [teams, setTeams] = useState<Team[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [teamId, setTeamId] = useState('')
  const [name, setName] = useState('')
  const [order, setOrder] = useState<number>(1)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadTeams(tid?: string) {
    const id = tid ?? tournamentId
    if (!id) { setTeams([]); return }
    const { data } = await supabase.from('teams').select('id,name,institution,tournament_id').eq('tournament_id', id).order('name')
    setTeams((data as Team[]) || [])
  }
  async function loadSpeakers(team?: string) {
    const id = team ?? teamId
    if (!id) { setSpeakers([]); return }
    const { data } = await supabase.from('speakers').select('id,name,team_id,speaker_order').eq('team_id', id).order('speaker_order')
    setSpeakers((data as Speaker[]) || [])
  }

  useEffect(() => { loadTeams(); setTeamId(''); setSpeakers([]) }, [tournamentId])
  useEffect(() => { loadSpeakers() }, [teamId])

  async function addSpeaker(e: React.FormEvent) {
    e.preventDefault()
    if (!teamId || !name) return
    setCreating(true); setError(null)
    try {
      const { error } = await supabase
        .from('speakers')
        .insert({ team_id: teamId, name, speaker_order: order || null })
      if (error) throw error
      setName('')
      setOrder(1)
      await loadSpeakers()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setCreating(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete speaker?')) return
    const { error } = await supabase.from('speakers').delete().eq('id', id)
    if (error) alert(error.message); else loadSpeakers()
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
        <form onSubmit={addSpeaker} className="flex flex-1 flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm text-zinc-300">Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div>
            <label className="block text-sm text-zinc-300">Order (1-3)</label>
            <input type="number" min={1} max={3} value={order} onChange={e=>setOrder(parseInt(e.target.value||'1'))} className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <button disabled={!teamId || !name || creating} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">{creating? 'Adding…':'Add Speaker'}</button>
        </form>
      </div>
      {error && <p className="mb-2 text-sm text-rose-400">Error: {error}</p>}

      <div className="grid gap-2">
        {speakers.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div>
              <div className="font-semibold text-white">{s.name}</div>
              <div className="text-xs text-zinc-500">Order: {s.speaker_order ?? '—'}</div>
            </div>
            <button onClick={()=>remove(s.id)} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/20">Delete</button>
          </div>
        ))}
        {speakers.length === 0 && <p className="text-sm text-zinc-400">No speakers for this team.</p>}
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import type { Team, Round } from '../../types/db'
import { useTournamentAdmin } from './TournamentAdminScope'

type Match = { id: string; round_id: string; chair_judge?: string | null }
type MatchTeam = { id: string; match_id: string; team_id: string; position: Position }
type Position = 'OG'|'OO'|'CG'|'CO'|'GOV'|'OPP'

export default function MatchTeamsAdmin() {
  const { tournamentId } = useTournamentAdmin()
  const [rounds, setRounds] = useState<Round[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [pairs, setPairs] = useState<MatchTeam[]>([])
  const [roundId, setRoundId] = useState('')
  const [matchId, setMatchId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [position, setPosition] = useState<Position>('OG')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadRounds(tid?: string) {
    const id = tid ?? tournamentId
    if (!id) { setRounds([]); return }
    const { data } = await supabase.from('rounds').select('id,round_number,tournament_id').eq('tournament_id', id).order('round_number')
    setRounds((data as any as Round[]) || [])
  }
  async function loadMatches(rid?: string) {
    const id = rid ?? roundId
    if (!id) { setMatches([]); return }
    const { data } = await supabase.from('matches').select('id,round_id,chair_judge').eq('round_id', id)
    setMatches((data as Match[]) || [])
  }
  async function loadTeams(tid?: string) {
    const id = tid ?? tournamentId
    if (!id) { setTeams([]); return }
    const { data } = await supabase.from('teams').select('id,name,institution,tournament_id').eq('tournament_id', id).order('name')
    setTeams((data as Team[]) || [])
  }
  async function loadPairs(mid?: string) {
    const id = mid ?? matchId
    if (!id) { setPairs([]); return }
    const { data } = await supabase.from('match_teams').select('id,match_id,team_id,position').eq('match_id', id)
    setPairs((data as MatchTeam[]) || [])
  }

  useEffect(() => { /* tournaments from scope */ }, [])
  useEffect(() => { loadRounds(); loadTeams(); setRoundId(''); setMatchId(''); setPairs([]) }, [tournamentId])
  useEffect(() => { loadMatches(); setMatchId(''); setPairs([]) }, [roundId])
  useEffect(() => { loadPairs() }, [matchId])

  async function addPair(e: React.FormEvent) {
    e.preventDefault()
    if (!matchId || !teamId) return
    setCreating(true); setError(null)
    try {
      const { error } = await supabase.from('match_teams').insert({ match_id: matchId, team_id: teamId, position })
      if (error) throw error
      setTeamId('')
      setPosition('OG')
      await loadPairs()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setCreating(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove team from match?')) return
    const { error } = await supabase.from('match_teams').delete().eq('id', id)
    if (error) alert(error.message); else loadPairs()
  }

  return (
    <section>
      <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
  {/* Tournament dropdown is provided by scope at top level */}
        <div>
          <label className="block text-sm text-zinc-300">Round</label>
          <select value={roundId} onChange={e=>setRoundId(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
            <option value="">— Choose —</option>
            {rounds.map(r => <option key={r.id} value={r.id}>Round {r.round_number}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-zinc-300">Match</label>
          <select value={matchId} onChange={e=>setMatchId(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
            <option value="">— Choose —</option>
            {matches.map(m => <option key={m.id} value={m.id}>{m.id.slice(0,8)}</option>)}
          </select>
        </div>
        <form onSubmit={addPair} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-sm text-zinc-300">Team</label>
            <select value={teamId} onChange={e=>setTeamId(e.target.value)} className="min-w-[200px] rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
              <option value="">— Choose —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-300">Position</label>
            <select value={position} onChange={e=>setPosition(e.target.value as Position)} className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
              {(['OG','OO','CG','CO','GOV','OPP'] as Position[]).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button disabled={!matchId || !teamId || creating} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">{creating? 'Add…':'Add Team'}</button>
        </form>
      </div>
      {error && <p className="mb-2 text-sm text-rose-400">Error: {error}</p>}

      <div className="grid gap-2">
        {pairs.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div>
              <div className="font-semibold text-white">{teams.find(t=>t.id===p.team_id)?.name ?? p.team_id}</div>
              <div className="text-xs text-zinc-500">Position: {p.position}</div>
            </div>
            <button onClick={()=>remove(p.id)} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/20">Remove</button>
          </div>
        ))}
        {pairs.length === 0 && <p className="text-sm text-zinc-400">No teams set for this match.</p>}
      </div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import type { Team, Round } from '../../types/db'
import { useTournamentAdmin } from './TournamentAdminScope'

type Match = { id: string; round_id: string }
type Result = { id: string; match_id: string; team_id: string; points: number; rank: number | null }

export default function ResultsAdmin() {
  const { tournamentId } = useTournamentAdmin()
  const [rounds, setRounds] = useState<Round[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [roundId, setRoundId] = useState('')
  const [matchId, setMatchId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [points, setPoints] = useState<number>(0)
  const [rank, setRank] = useState<number | ''>('')
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
    const { data } = await supabase.from('matches').select('id,round_id').eq('round_id', id)
    setMatches((data as Match[]) || [])
  }
  async function loadTeams(tid?: string) {
    const id = tid ?? tournamentId
    if (!id) { setTeams([]); return }
    const { data } = await supabase.from('teams').select('id,name,institution,tournament_id').eq('tournament_id', id).order('name')
    setTeams((data as Team[]) || [])
  }
  async function loadResults(mid?: string) {
    const id = mid ?? matchId
    if (!id) { setResults([]); return }
    const { data } = await supabase.from('results').select('id,match_id,team_id,points,rank').eq('match_id', id)
    setResults((data as Result[]) || [])
  }

  useEffect(() => { loadRounds(); loadTeams(); setRoundId(''); setMatchId(''); setResults([]) }, [tournamentId])
  useEffect(() => { loadMatches(); setMatchId(''); setResults([]) }, [roundId])
  useEffect(() => { loadResults() }, [matchId])

  async function addResult(e: React.FormEvent) {
    e.preventDefault()
    if (!matchId || !teamId) return
    setCreating(true); setError(null)
    try {
      const payload: any = { match_id: matchId, team_id: teamId, points }
      payload.rank = rank === '' ? null : Number(rank)
      const { error } = await supabase.from('results').insert(payload)
      if (error) throw error
      setTeamId('')
      setPoints(0)
      setRank('')
      await loadResults()
    } catch (err: any) {
      setError(err?.message ?? String(err))
    } finally {
      setCreating(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete result?')) return
    const { error } = await supabase.from('results').delete().eq('id', id)
    if (error) alert(error.message); else loadResults()
  }

  return (
    <section>
  <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
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
        <form onSubmit={addResult} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-sm text-zinc-300">Team</label>
            <select value={teamId} onChange={e=>setTeamId(e.target.value)} className="min-w-[200px] rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
              <option value="">— Choose —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-300">Points (0-3)</label>
            <input type="number" min={0} max={3} value={points} onChange={e=>setPoints(parseInt(e.target.value||'0'))} className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div>
            <label className="block text-sm text-zinc-300">Rank (1-4)</label>
            <input type="number" min={1} max={4} value={rank} onChange={e=>setRank(e.target.value===''? '': parseInt(e.target.value))} className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <button disabled={!matchId || !teamId || creating} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">{creating? 'Add…':'Add Result'}</button>
        </form>
      </div>
      {error && <p className="mb-2 text-sm text-rose-400">Error: {error}</p>}

      <div className="grid gap-2">
        {results.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div>
              <div className="font-semibold text-white">{teams.find(t=>t.id===r.team_id)?.name ?? r.team_id}</div>
              <div className="text-xs text-zinc-500">Points: {r.points} {r.rank ? `• Rank: ${r.rank}` : ''}</div>
            </div>
            <button onClick={()=>remove(r.id)} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/20">Delete</button>
          </div>
        ))}
        {results.length === 0 && <p className="text-sm text-zinc-400">No results for this match.</p>}
      </div>
    </section>
  )
}

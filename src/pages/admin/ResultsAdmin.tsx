import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import type { Team, Round, Tournament } from '../../types/db'
import { useTournamentAdmin } from './TournamentAdminScope'

type Match = { id: string; round_id: string }
type Result = { id: string; match_id: string; team_id: string; points: number; rank: number | null }

// Point calculation based on tournament format
const calculatePoints = (format: 'BP' | 'AP', rank: number): number => {
  if (format === 'BP') {
    // British Parliamentary: 1st=3pts, 2nd=2pts, 3rd=1pt, 4th=0pts
    switch (rank) {
      case 1: return 3
      case 2: return 2
      case 3: return 1
      case 4: return 0
      default: return 0
    }
  } else if (format === 'AP') {
    // Asian Parliamentary: 1st=3pts, 2nd=2pts, 3rd=1pt, 4th=0pts (same as BP for now)
    switch (rank) {
      case 1: return 3
      case 2: return 2
      case 3: return 1
      case 4: return 0
      default: return 0
    }
  }
  return 0
}

export default function ResultsAdmin() {
  const { tournamentId } = useTournamentAdmin()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [roundId, setRoundId] = useState('')
  const [matchId, setMatchId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [rank, setRank] = useState<number | ''>('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadTournament(tid?: string) {
    const id = tid ?? tournamentId
    if (!id) { setTournament(null); return }
    const { data } = await supabase.from('tournaments').select('id,name,format').eq('id', id).maybeSingle()
    setTournament(data as Tournament)
  }

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

  useEffect(() => { 
    loadTournament(); 
    loadRounds(); 
    loadTeams(); 
    setRoundId(''); 
    setMatchId(''); 
    setResults([]) 
  }, [tournamentId])
  useEffect(() => { loadMatches(); setMatchId(''); setResults([]) }, [roundId])
  useEffect(() => { loadResults() }, [matchId])

  async function addResult(e: React.FormEvent) {
    e.preventDefault()
    if (!matchId || !teamId || rank === '' || !tournament) return
    
    setCreating(true); setError(null)
    try {
      // Auto-calculate points based on tournament format and rank
      const rankNumber = Number(rank)
      const points = calculatePoints(tournament.format || 'BP', rankNumber)
      
      const payload: any = { 
        match_id: matchId, 
        team_id: teamId, 
        points: points,
        rank: rankNumber
      }
      
      const { error } = await supabase.from('results').insert(payload)
      if (error) throw error
      
      setTeamId('')
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
      {/* Info Banner */}
      <div className="mb-6 rounded-lg bg-blue-900/30 border border-blue-700/50 p-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">ℹ️</div>
          <div>
            <h3 className="text-lg font-semibold text-blue-200">Auto-Calculated Results</h3>
            <p className="text-sm text-blue-300 mt-1">
              Team rankings and points are now automatically calculated from Speaker Scores. 
              Go to <strong>Speaker Scores</strong> tab to input individual speaker scores, 
              and team results will be generated automatically based on total team scores.
            </p>
          </div>
        </div>
      </div>

      {/* Tournament Format Info */}
      {tournament && (
        <div className="mb-4 rounded-lg bg-zinc-800 p-4">
          <h3 className="text-lg font-semibold text-white">Tournament: {tournament.name}</h3>
          <p className="text-sm text-zinc-400">
            Format: <span className="font-medium text-white">{tournament.format || 'BP'}</span>
            {' '} | Points: 1st=3pts, 2nd=2pts, 3rd=1pt, 4th=0pts
          </p>
        </div>
      )}

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
      </div>

      {/* Manual Entry (Deprecated) */}
      <div className="mb-6 rounded-lg bg-yellow-900/20 border border-yellow-700/50 p-4">
        <h4 className="text-yellow-200 font-medium mb-2">⚠️ Manual Entry (Not Recommended)</h4>
        <p className="text-sm text-yellow-300 mb-3">
          This manual entry method is deprecated. Results should be calculated automatically from Speaker Scores.
        </p>
        <form onSubmit={addResult} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-sm text-zinc-300">Team</label>
            <select value={teamId} onChange={e=>setTeamId(e.target.value)} className="min-w-[200px] rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
              <option value="">— Choose —</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-300">Rank (1-4)</label>
            <select value={rank} onChange={e=>setRank(e.target.value===''? '': parseInt(e.target.value))} className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
              <option value="">—</option>
              <option value="1">1st</option>
              <option value="2">2nd</option>
              <option value="3">3rd</option>
              <option value="4">4th</option>
            </select>
          </div>
          {rank !== '' && tournament && (
            <div className="text-sm text-zinc-400">
              → {calculatePoints(tournament.format || 'BP', Number(rank))} points
            </div>
          )}
          <button disabled={!matchId || !teamId || rank === '' || creating} className="rounded-md bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-500 disabled:opacity-60">{creating? 'Add…':'Manual Add'}</button>
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

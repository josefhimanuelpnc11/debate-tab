import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../config/supabase'
import { useTournamentAdmin } from './TournamentAdminScope'

type Team = { id: string; name: string }
type PreviewMatch = {
  teams: Team[]
  positions: string[]
}

export default function RoundsAdmin() {
  const { tournamentId, current } = useTournamentAdmin()
  const [rounds, setRounds] = useState<Array<{id:string;round_number:number;motion?:string|null}>>([])
  const [roundNumber, setRoundNumber] = useState<number>(1)
  const [motion, setMotion] = useState('')
  const [mode, setMode] = useState<'random'|'rank'>('random')
  const [busyRoundId, setBusyRoundId] = useState<string | null>(null)
  const [previewMatches, setPreviewMatches] = useState<PreviewMatch[]>([])
  const [previewRoundId, setPreviewRoundId] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [generating, setGenerating] = useState(false)
  async function loadRounds(tid?: string) {
    const id = tid ?? tournamentId
    if (!id) { setRounds([]); return }
    const { data } = await supabase.from('rounds').select('id,round_number,motion').eq('tournament_id', id).order('round_number')
    setRounds((data as any) || [])
  }

  async function loadTeams(tid?: string) {
    const id = tid ?? tournamentId
    if (!id) { setTeams([]); return }
    const { data } = await supabase.from('teams').select('id,name').eq('tournament_id', id).order('name')
    setTeams((data as Team[]) || [])
  }

  useEffect(() => { 
    loadRounds() 
    loadTeams()
  }, [tournamentId])

  async function createRound(e: React.FormEvent) {
    e.preventDefault()
    if (!tournamentId) return
    const { error } = await supabase.from('rounds').insert({ tournament_id: tournamentId, round_number: roundNumber, motion: motion || null })
    if (error) alert(error.message); else { setMotion(''); loadRounds() }
  }

  async function remove(id: string) {
    if (!confirm('Delete round?')) return
    const { error } = await supabase.from('rounds').delete().eq('id', id)
    if (error) alert(error.message); else loadRounds()
  }

  const format = useMemo(() => (current?.format ?? 'BP') as 'BP'|'AP', [current?.format])

  async function generatePreview(roundId: string, roundNum: number) {
    if (!tournamentId) return
    setGenerating(true)
    setPreviewRoundId(roundId)
    try {
      let teamIds: string[] = teams.map(t => t.id)

      if (mode === 'rank') {
        const { data: prevRounds } = await supabase
          .from('rounds').select('id').eq('tournament_id', tournamentId).lt('round_number', roundNum)
        const prevRoundIds = (prevRounds ?? []).map(r => r.id)
        if (prevRoundIds.length > 0) {
          const { data: prevMatches } = await supabase
            .from('matches').select('id,round_id').in('round_id', prevRoundIds)
          const prevMatchIds = (prevMatches ?? []).map(m => m.id)
          if (prevMatchIds.length > 0) {
            const { data: prevResults } = await supabase
              .from('results').select('team_id,points,match_id').in('match_id', prevMatchIds)
            const scores = new Map<string, number>()
            for (const r of (prevResults ?? [])) {
              const tid = (r as { team_id: string }).team_id
              const pts = (r as { points: number }).points
              scores.set(tid, (scores.get(tid) ?? 0) + pts)
            }
            teamIds.sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0))
          }
        }
      } else {
        // Shuffle for random mode
        for (let i = teamIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]]
        }
      }

      const groupSize = format === 'BP' ? 4 : 2
      const positions = format === 'BP' ? ['OG','OO','CG','CO'] : ['GOV','OPP']
      const matches: PreviewMatch[] = []

      for (let i = 0; i < teamIds.length; i += groupSize) {
        const chunk = teamIds.slice(i, i + groupSize)
        if (chunk.length < 2) break
        
        const matchTeams = chunk.map(teamId => teams.find(t => t.id === teamId)!).filter(Boolean)
        matches.push({
          teams: matchTeams,
          positions: positions.slice(0, matchTeams.length)
        })
      }
      
      setPreviewMatches(matches)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert('Failed to generate preview: ' + msg)
    } finally {
      setGenerating(false)
    }
  }

  async function savePreviewPairings() {
    if (!previewRoundId || previewMatches.length === 0) return
    setBusyRoundId(previewRoundId)
    try {
      // Delete existing matches for this round
      const { data: existingMatches } = await supabase.from('matches').select('id').eq('round_id', previewRoundId)
      if ((existingMatches?.length ?? 0) > 0) {
        await supabase.from('matches').delete().eq('round_id', previewRoundId)
      }

      // Create matches from preview
      for (const previewMatch of previewMatches) {
        const { data: match, error: matchErr } = await supabase
          .from('matches').insert({ round_id: previewRoundId }).select('id').single()
        if (matchErr) throw matchErr
        const matchId = (match as any).id as string
        
        const rows = previewMatch.teams.map((team, idx) => ({ 
          match_id: matchId, 
          team_id: team.id, 
          position: previewMatch.positions[idx] 
        }))
        const { error: mtErr } = await supabase.from('match_teams').insert(rows)
        if (mtErr) throw mtErr
      }
      
      alert('Pairings saved successfully!')
      setPreviewMatches([])
      setPreviewRoundId(null)
      await loadRounds()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert('Failed to save pairings: ' + msg)
    } finally {
      setBusyRoundId(null)
    }
  }

  function clearPreview() {
    setPreviewMatches([])
    setPreviewRoundId(null)
  }

  async function generatePairings(roundId: string, roundNum: number) {
    if (!tournamentId) return
    setBusyRoundId(roundId)
    try {
      const { data: existingMatches } = await supabase.from('matches').select('id').eq('round_id', roundId)
      if ((existingMatches?.length ?? 0) > 0) {
        const ok = confirm('This round already has matches. Overwrite pairings?')
        if (!ok) { setBusyRoundId(null); return }
        await supabase.from('matches').delete().eq('round_id', roundId)
      }

      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams').select('id').eq('tournament_id', tournamentId).order('name')
      if (teamsErr) throw teamsErr
      let teamIds: string[] = (teamsData ?? []).map((t: any) => t.id as string)

      if (mode === 'rank') {
        const { data: prevRounds } = await supabase
          .from('rounds').select('id').eq('tournament_id', tournamentId).lt('round_number', roundNum)
        const prevRoundIds = (prevRounds ?? []).map(r => r.id)
        if (prevRoundIds.length > 0) {
          const { data: prevMatches } = await supabase
            .from('matches').select('id,round_id').in('round_id', prevRoundIds)
          const prevMatchIds = (prevMatches ?? []).map(m => m.id)
          if (prevMatchIds.length > 0) {
            const { data: prevResults } = await supabase
              .from('results').select('team_id,points,match_id').in('match_id', prevMatchIds)
            const scores = new Map<string, number>()
            for (const r of (prevResults ?? [])) {
              const tid = (r as { team_id: string }).team_id
              const pts = (r as { points: number }).points
              scores.set(tid, (scores.get(tid) ?? 0) + pts)
            }
            teamIds.sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0))
          }
        }
      } else {
        for (let i = teamIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[teamIds[i], teamIds[j]] = [teamIds[j], teamIds[i]]
        }
      }

      const groupSize = format === 'BP' ? 4 : 2
      const positions = format === 'BP' ? ['OG','OO','CG','CO'] as const : ['GOV','OPP'] as const

      for (let i = 0; i < teamIds.length; i += groupSize) {
        const chunk = teamIds.slice(i, i + groupSize)
        if (chunk.length < 2) break
        const { data: match, error: matchErr } = await supabase
          .from('matches').insert({ round_id: roundId }).select('id').single()
        if (matchErr) throw matchErr
        const matchId = (match as any).id as string
        const rows = chunk.map((teamId, idx) => ({ match_id: matchId, team_id: teamId, position: positions[idx] }))
        const { error: mtErr } = await supabase.from('match_teams').insert(rows)
        if (mtErr) throw mtErr
      }
      alert('Pairings generated.')
      await loadRounds()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert('Failed to generate pairings: ' + msg)
    } finally {
      setBusyRoundId(null)
    }
  }

  return (
    <section>
  <div className="mb-3 flex flex-wrap items-end gap-2">
        <form onSubmit={createRound} className="flex flex-1 flex-wrap items-end gap-2">
          <div>
            <label className="block text-sm text-zinc-300">Round #</label>
            <input type="number" min={1} value={roundNumber} onChange={e=>setRoundNumber(parseInt(e.target.value||'1'))} className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm text-zinc-300">Motion</label>
            <input value={motion} onChange={e=>setMotion(e.target.value)} className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none" />
          </div>
          <button disabled={!tournamentId} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">Add Round</button>
        </form>
      </div>

      {/* Preview Section */}
      {previewMatches.length > 0 && (
        <div className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-blue-200">Preview Pairings</h3>
            <div className="flex gap-2">
              <button
                onClick={savePreviewPairings}
                disabled={busyRoundId === previewRoundId}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-60"
              >
                {busyRoundId === previewRoundId ? 'Saving...' : 'Save Pairings'}
              </button>
              <button
                onClick={clearPreview}
                className="rounded-md border border-zinc-600 bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-600"
              >
                Clear Preview
              </button>
            </div>
          </div>
          <div className="grid gap-3">
            {previewMatches.map((match, idx) => (
              <div key={idx} className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                <div className="text-sm font-medium text-zinc-300 mb-2">Match {idx + 1}</div>
                <div className="grid gap-2">
                  {match.teams.map((team, teamIdx) => (
                    <div key={team.id} className="flex items-center justify-between rounded-md bg-zinc-700/50 px-3 py-2">
                      <span className="font-medium text-white">{team.name}</span>
                      <span className="text-xs font-medium text-zinc-400 bg-zinc-600 px-2 py-1 rounded">
                        {match.positions[teamIdx]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2">
        {rounds.map((r) => (
          <div key={r.id} className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold text-white">Round {r.round_number}</div>
              {r.motion && <div className="text-sm text-zinc-400">{r.motion}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-zinc-400">Mode</label>
              <select value={mode} onChange={e=>setMode(e.target.value as 'random'|'rank')} className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-white outline-none">
                <option value="random">Random</option>
                <option value="rank">Rank-based</option>
              </select>
              <button 
                disabled={!tournamentId || generating} 
                onClick={()=>generatePreview(r.id, r.round_number)} 
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {generating && previewRoundId === r.id ? 'Generating...' : 'Preview Pairings'}
              </button>
              <button 
                disabled={!tournamentId || busyRoundId === r.id} 
                onClick={()=>generatePairings(r.id, r.round_number)} 
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {busyRoundId===r.id? 'Generating…':'Generate Direct'}
              </button>
              <button onClick={()=>remove(r.id)} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/20">Delete</button>
            </div>
          </div>
        ))}
        {rounds.length === 0 && <p className="text-sm text-zinc-400">No rounds for this tournament.</p>}
      </div>
    </section>
  )
}

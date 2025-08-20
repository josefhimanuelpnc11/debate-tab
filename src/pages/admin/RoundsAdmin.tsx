import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../config/supabase'
import { useTournamentAdmin } from './TournamentAdminScope'

export default function RoundsAdmin() {
  const { tournamentId, current } = useTournamentAdmin()
  const [rounds, setRounds] = useState<Array<{id:string;round_number:number;motion?:string|null}>>([])
  const [roundNumber, setRoundNumber] = useState<number>(1)
  const [motion, setMotion] = useState('')
  const [mode, setMode] = useState<'random'|'rank'>('random')
  const [busyRoundId, setBusyRoundId] = useState<string | null>(null)
  async function loadRounds(tid?: string) {
    const id = tid ?? tournamentId
    if (!id) { setRounds([]); return }
    const { data } = await supabase.from('rounds').select('id,round_number,motion').eq('tournament_id', id).order('round_number')
    setRounds((data as any) || [])
  }

  useEffect(() => { loadRounds() }, [tournamentId])

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
              <button disabled={!tournamentId || busyRoundId === r.id} onClick={()=>generatePairings(r.id, r.round_number)} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60">{busyRoundId===r.id? 'Generating…':'Generate pairings'}</button>
              <button onClick={()=>remove(r.id)} className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/20">Delete</button>
            </div>
          </div>
        ))}
        {rounds.length === 0 && <p className="text-sm text-zinc-400">No rounds for this tournament.</p>}
      </div>
    </section>
  )
}

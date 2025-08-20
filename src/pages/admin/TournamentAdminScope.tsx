import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Outlet, useParams, Link } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import type { Tournament } from '../../types/db'

type Ctx = {
  tournamentId: string
  setTournamentId: (id: string)=>void
  tournaments: Tournament[]
  current?: Tournament | null
}

const TournamentAdminContext = createContext<Ctx | null>(null)

export function useTournamentAdmin() {
  const ctx = useContext(TournamentAdminContext)
  if (!ctx) throw new Error('useTournamentAdmin must be used within TournamentAdminScope')
  return ctx
}

export default function TournamentAdminScope() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [tournamentId, setTournamentId] = useState('')
  const params = useParams()

  useEffect(() => {
    supabase.from('tournaments').select('id,name,description,format').order('name')
      .then(({ data }) => setTournaments((data as Tournament[]) || []))
  }, [])

  const current = useMemo(() => tournaments.find(t => t.id === tournamentId) ?? null, [tournamentId, tournaments])

  // When route provides :id, prefer that and hide picker
  useEffect(() => {
    const pid = params.id
    if (pid && pid !== tournamentId) setTournamentId(pid)
  }, [params.id])

  return (
    <TournamentAdminContext.Provider value={{ tournamentId, setTournamentId, tournaments, current }}>
      <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {!params.id ? (
            <div>
              <label className="block text-sm text-zinc-300">Tournament scope</label>
              <select value={tournamentId} onChange={e=>setTournamentId(e.target.value)} className="min-w-[220px] rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none">
                <option value="">— Choose —</option>
                {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          ) : (
            <div className="text-sm text-zinc-300">
              <div className="text-white">{current?.name ?? params.id}</div>
              <div className="mt-1 text-xs text-zinc-400">
                <span className="mr-2 rounded border border-zinc-700 px-1.5 py-0.5">{current?.format ?? 'BP'}</span>
                <Link className="underline-offset-2 hover:underline" to={`/tournament/${params.id}`}>View public page</Link>
              </div>
            </div>
          )}
          {current && !params.id && (
            <div className="text-sm text-zinc-400">
              <span className="mr-2 rounded border border-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">{current.format ?? 'BP'}</span>
              {current.description ?? ''}
            </div>
          )}
        </div>
      </div>
  <Outlet />
    </TournamentAdminContext.Provider>
  )
}

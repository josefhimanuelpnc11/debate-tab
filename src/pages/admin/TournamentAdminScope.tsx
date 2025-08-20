import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Outlet, useParams, Link, useLocation, Navigate } from 'react-router-dom'
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

type AdminTabType = 'teams' | 'rounds' | 'speakers' | 'speaker-scores' | 'match-teams'

export default function TournamentAdminScope() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [tournamentId, setTournamentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const params = useParams()
  const location = useLocation()

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('tournaments')
          .select('id,name,description,format,created_at')
          .order('name')
        if (error) throw error
        setTournaments((data as Tournament[]) || [])
      } catch (err: any) {
        setError(err.message || String(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const current = useMemo(() => tournaments.find(t => t.id === tournamentId) ?? null, [tournamentId, tournaments])

  // When route provides :id, prefer that
  useEffect(() => {
    const pid = params.id
    if (pid && pid !== tournamentId) setTournamentId(pid)
  }, [params.id])

  // Get current admin tab from URL
  const currentAdminTab = useMemo(() => {
    const path = location.pathname
    if (path.includes('/teams')) return 'teams'
    if (path.includes('/rounds')) return 'rounds'
    if (path.includes('/speakers') && !path.includes('/speaker-scores')) return 'speakers'
    if (path.includes('/speaker-scores')) return 'speaker-scores'
    if (path.includes('/match-teams')) return 'match-teams'
    return null
  }, [location.pathname])

  // If we're on tournament base URL without admin tab, redirect to teams
  if (params.id && !currentAdminTab && location.pathname === `/admin/tournament/${params.id}`) {
    return <Navigate to={`/admin/tournament/${params.id}/teams`} replace />
  }

  // Redirect legacy URLs to appropriate pages
  if (params.id && location.pathname.includes('/members')) {
    return <Navigate to={`/admin/tournament/${params.id}/teams`} replace />
  }
  if (params.id && location.pathname.includes('/results')) {
    return <Navigate to={`/admin/tournament/${params.id}/speaker-scores`} replace />
  }

  const adminTabs = [
    { id: 'teams' as AdminTabType, label: 'Teams', icon: '👥' },
    { id: 'rounds' as AdminTabType, label: 'Rounds', icon: '🎯' },
    { id: 'speakers' as AdminTabType, label: 'Speakers', icon: '🎤' },
    { id: 'speaker-scores' as AdminTabType, label: 'Speaker Scores', icon: '📊' },
    { id: 'match-teams' as AdminTabType, label: 'Match Teams', icon: '⚔️' },
  ]

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading tournament...</p>
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <p className="text-red-400 text-xl">Error: {error}</p>
        </div>
      </div>
    </div>
  )

  if (!current && tournamentId) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">🔍</div>
          <p className="text-white text-xl">Tournament not found</p>
        </div>
      </div>
    </div>
  )

  return (
    <TournamentAdminContext.Provider value={{ tournamentId, setTournamentId, tournaments, current }}>
      <div className="min-h-screen bg-zinc-900">
        {/* Header */}
        <div className="bg-zinc-800 border-b border-zinc-700 shadow-lg">
          <div className="mx-auto max-w-7xl px-4">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-4">
                    <Link 
                      to="/admin/tournaments" 
                      className="text-zinc-400 hover:text-white transition-colors"
                      title="Back to tournaments"
                    >
                      ← Back
                    </Link>
                    <div>
                      <h1 className="text-3xl font-bold text-white">
                        {current?.name || 'Tournament Admin'}
                      </h1>
                      <div className="flex items-center space-x-3 mt-1">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-900/60 text-indigo-200 border border-indigo-700">
                          {current?.format || 'BP'} Format
                        </span>
                        <span className="text-zinc-400 text-sm">Admin Panel</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Link 
                    to={`/tournament/${tournamentId}`}
                    className="inline-flex items-center px-4 py-2 border border-zinc-600 rounded-md text-sm font-medium text-zinc-300 bg-zinc-700 hover:bg-zinc-600 transition-colors"
                  >
                    👁️ View Public Page
                  </Link>
                  <Link 
                    to="/admin"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                  >
                    🏠 Admin Home
                  </Link>
                </div>
              </div>
              {current?.description && (
                <p className="text-zinc-300 mt-2 max-w-4xl">{current.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10">
          <div className="mx-auto max-w-7xl px-4">
            <nav className="flex space-x-8 overflow-x-auto">
              {adminTabs.map(tab => (
                <Link
                  key={tab.id}
                  to={`/admin/tournament/${tournamentId}/${tab.id}`}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    currentAdminTab === tab.id
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 py-8">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-8">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-zinc-900 border-t border-zinc-800 text-zinc-400 py-8">
          <div className="mx-auto max-w-7xl px-4">
            <div className="text-center">
              <p className="text-zinc-400">
                Tournament Admin Panel - {current?.name}
              </p>
              <p className="text-zinc-500 text-sm mt-2">
                Tournament ID: {tournamentId ? tournamentId.slice(0, 8) + '...' : 'N/A'}
              </p>
            </div>
          </div>
        </footer>
      </div>
    </TournamentAdminContext.Provider>
  )
}

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../config/supabase'
import type { Tournament } from '../types/db'

interface TournamentCardProps {
  tournament: Tournament & {
    teams_count?: number
    rounds_count?: number
    current_round?: { name: string; seq: number } | null
  }
}

const TournamentCard: React.FC<TournamentCardProps> = ({ tournament }) => {
  return (
    <Link 
      to={`/tournament/${tournament.slug}`}
      className="block bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{tournament.name}</h3>
          {tournament.short_name && (
            <p className="text-sm text-gray-600 font-medium">{tournament.short_name}</p>
          )}
        </div>
        <div className="flex items-center">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            tournament.active 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {tournament.active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {tournament.description && (
        <p className="text-gray-600 mb-4 line-clamp-2">{tournament.description}</p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Format</p>
          <p className="font-medium">{tournament.format}</p>
        </div>
        <div>
          <p className="text-gray-500">Teams</p>
          <p className="font-medium">{tournament.teams_count || 0}</p>
        </div>
        <div>
          <p className="text-gray-500">Rounds</p>
          <p className="font-medium">{tournament.rounds_count || 0}</p>
        </div>
        <div>
          <p className="text-gray-500">Current Round</p>
          <p className="font-medium">
            {tournament.current_round ? tournament.current_round.name : 'Not started'}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Created {new Date(tournament.created_at || '').toLocaleDateString()}
        </p>
      </div>
    </Link>
  )
}

const TournamentList: React.FC = () => {
  const [tournaments, setTournaments] = useState<(Tournament & {
    teams_count?: number
    rounds_count?: number
    current_round?: { name: string; seq: number } | null
  })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTournaments = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get tournaments with counts and current round info
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          current_round:rounds!tournaments_current_round_id_fkey(name, seq),
          teams:teams(count),
          rounds:rounds(count)
        `)
        .eq('active', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Transform the data to include counts
      const tournamentsWithCounts = data?.map(tournament => ({
        ...tournament,
        teams_count: tournament.teams?.length || 0,
        rounds_count: tournament.rounds?.length || 0
      })) || []

      setTournaments(tournamentsWithCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournaments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTournaments()

    // Set up real-time subscription
    const channel = supabase
      .channel('tournaments')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments'
      }, () => {
        loadTournaments()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-lg h-48 animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading tournaments</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tournaments</h1>
          <p className="text-gray-600 mt-2">
            {tournaments.length} active tournament{tournaments.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <Link
          to="/admin/tournaments/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Create Tournament
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-6m-8 0h8M9 7h6" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tournaments</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new tournament.</p>
          <div className="mt-6">
            <Link
              to="/admin/tournaments/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Create Tournament
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      )}
    </div>
  )
}

export default TournamentList

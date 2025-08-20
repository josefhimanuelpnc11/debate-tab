import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import type { Tournament, Round, Team, Adjudicator, TournamentState } from '../types/db'

export const useTournament = (slug?: string) => {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [currentRound, setCurrentRound] = useState<Round | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [adjudicators, setAdjudicators] = useState<Adjudicator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load tournament by slug
  const loadTournament = async (tournamentSlug: string) => {
    try {
      setLoading(true)
      setError(null)

      // Get tournament with current round
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select(`
          *,
          current_round:rounds(*)
        `)
        .eq('slug', tournamentSlug)
        .eq('active', true)
        .single()

      if (tournamentError) throw tournamentError

      setTournament(tournamentData)
      setCurrentRound(tournamentData.current_round)

      // Load tournament participants
      await Promise.all([
        loadTeams(tournamentData.id),
        loadAdjudicators(tournamentData.id)
      ])

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament')
    } finally {
      setLoading(false)
    }
  }

  // Load teams for tournament
  const loadTeams = async (tournamentId: string) => {
    const { data, error } = await supabase
      .from('teams')
      .select(`
        *,
        institution:institutions(name, code),
        speakers:speakers(*)
      `)
      .eq('tournament_id', tournamentId)
      .order('short_name')

    if (error) throw error
    setTeams(data || [])
  }

  // Load adjudicators for tournament
  const loadAdjudicators = async (tournamentId: string) => {
    const { data, error } = await supabase
      .from('adjudicators')
      .select(`
        *,
        institution:institutions(name, code),
        user:users(full_name, email)
      `)
      .eq('tournament_id', tournamentId)
      .order('name')

    if (error) throw error
    setAdjudicators(data || [])
  }

  // Get tournament state
  const getTournamentState = async (tournamentId: string): Promise<TournamentState | null> => {
    try {
      const { data, error } = await supabase
        .rpc('get_tournament_state', { tournament_uuid: tournamentId })

      if (error) throw error
      return data
    } catch (err) {
      console.error('Failed to get tournament state:', err)
      return null
    }
  }

  // Create sample tournament for testing
  const createSampleTournament = async () => {
    try {
      const { data, error } = await supabase
        .rpc('create_sample_tournament')

      if (error) throw error
      return data // Returns tournament UUID
    } catch (err) {
      console.error('Failed to create sample tournament:', err)
      throw err
    }
  }

  // Initialize tournament on slug change
  useEffect(() => {
    if (slug) {
      loadTournament(slug)
    }
  }, [slug])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!tournament) return

    const channel = supabase
      .channel(`tournament:${tournament.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teams',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => {
        loadTeams(tournament.id)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'adjudicators',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => {
        loadAdjudicators(tournament.id)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => {
        loadTournament(tournament.slug)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournament])

  return {
    tournament,
    currentRound,
    teams,
    adjudicators,
    loading,
    error,
    loadTournament,
    getTournamentState,
    createSampleTournament,
    refetch: () => tournament && loadTournament(tournament.slug)
  }
}

export default useTournament

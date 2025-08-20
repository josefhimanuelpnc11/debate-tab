import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import type { TeamStanding, SpeakerStandingNew } from '../types/db'

export const useStandings = (tournamentId?: string) => {
  const [teamStandings, setTeamStandings] = useState<TeamStanding[]>([])
  const [speakerStandings, setSpeakerStandings] = useState<SpeakerStandingNew[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load team standings
  const loadTeamStandings = async (tournamentUuid: string) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .rpc('calculate_team_standings', { tournament_uuid: tournamentUuid })

      if (error) throw error
      setTeamStandings(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team standings')
    } finally {
      setLoading(false)
    }
  }

  // Load speaker standings
  const loadSpeakerStandings = async (tournamentUuid: string) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .rpc('calculate_speaker_standings', { tournament_uuid: tournamentUuid })

      if (error) throw error
      setSpeakerStandings(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load speaker standings')
    } finally {
      setLoading(false)
    }
  }

  // Load both standings
  const loadAllStandings = async (tournamentUuid: string) => {
    await Promise.all([
      loadTeamStandings(tournamentUuid),
      loadSpeakerStandings(tournamentUuid)
    ])
  }

  // Auto-load when tournamentId changes
  useEffect(() => {
    if (tournamentId) {
      loadAllStandings(tournamentId)
    }
  }, [tournamentId])

  // Set up real-time subscriptions for result changes
  useEffect(() => {
    if (!tournamentId) return

    const channel = supabase
      .channel(`standings:${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ballot_submissions'
      }, () => {
        // Refresh standings when new results are submitted
        loadAllStandings(tournamentId)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_scores'
      }, () => {
        loadTeamStandings(tournamentId)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'speaker_scores_new'
      }, () => {
        loadSpeakerStandings(tournamentId)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId])

  return {
    teamStandings,
    speakerStandings,
    loading,
    error,
    loadTeamStandings,
    loadSpeakerStandings,
    loadAllStandings,
    refetch: () => tournamentId && loadAllStandings(tournamentId)
  }
}

export default useStandings

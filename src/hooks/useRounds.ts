import { useState, useEffect } from 'react'
import { supabase } from '../config/supabase'
import type { Round, Debate, DebateTeam, Motion, Venue } from '../types/db'

interface DrawData {
  debates: (Debate & {
    venue?: Venue
    debate_teams: (DebateTeam & {
      team: {
        id: string
        short_name: string
        institution?: { name: string; code: string }
      }
    })[]
    motions?: Motion[]
  })[]
}

export const useRounds = (tournamentId?: string) => {
  const [rounds, setRounds] = useState<Round[]>([])
  const [currentDraw, setCurrentDraw] = useState<DrawData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load all rounds for tournament
  const loadRounds = async (tournamentUuid: string) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('tournament_id', tournamentUuid)
        .order('seq')

      if (error) throw error
      setRounds(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rounds')
    } finally {
      setLoading(false)
    }
  }

  // Load draw for specific round
  const loadDraw = async (roundId: string) => {
    try {
      setLoading(true)
      setError(null)

      const { data: debates, error } = await supabase
        .from('debates')
        .select(`
          *,
          venue:venues(*),
          debate_teams:debate_teams(
            *,
            team:teams(
              id,
              short_name,
              institution:institutions(name, code)
            )
          ),
          motions:motions(*)
        `)
        .eq('round_id', roundId)
        .order('room_rank')

      if (error) throw error

      setCurrentDraw({ debates: debates || [] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load draw')
    } finally {
      setLoading(false)
    }
  }

  // Create new round
  const createRound = async (tournamentId: string, roundData: {
    name: string
    abbreviation?: string
    stage?: 'preliminary' | 'elimination'
    draw_type?: 'random' | 'manual' | 'round_robin' | 'power_paired' | 'elimination' | 'seeded'
  }) => {
    try {
      // Get next sequence number
      const { data: lastRound } = await supabase
        .from('rounds')
        .select('seq')
        .eq('tournament_id', tournamentId)
        .order('seq', { ascending: false })
        .limit(1)
        .single()

      const nextSeq = (lastRound?.seq || 0) + 1

      const { data, error } = await supabase
        .from('rounds')
        .insert({
          tournament_id: tournamentId,
          seq: nextSeq,
          ...roundData
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      console.error('Failed to create round:', err)
      throw err
    }
  }

  // Update round status
  const updateRoundStatus = async (roundId: string, updates: {
    draw_status?: 'none' | 'draft' | 'confirmed' | 'released'
    completed?: boolean
    motions_released?: boolean
  }) => {
    try {
      const { data, error } = await supabase
        .from('rounds')
        .update(updates)
        .eq('id', roundId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      console.error('Failed to update round status:', err)
      throw err
    }
  }

  // Generate draw (simplified - in real implementation would be more complex)
  const generateDraw = async (roundId: string, options: {
    drawType?: 'random' | 'power_paired'
    avoidConflicts?: boolean
  } = {}) => {
    try {
      setLoading(true)
      setError(null)

      // Get round and tournament info
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .select('*, tournament:tournaments(*)')
        .eq('id', roundId)
        .single()

      if (roundError) throw roundError

      // Get available teams
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', round.tournament_id)

      if (teamsError) throw teamsError

      // Get available venues
      const { data: venues, error: venuesError } = await supabase
        .from('venues')
        .select('*')
        .eq('tournament_id', round.tournament_id)
        .order('priority', { ascending: false })

      if (venuesError) throw venuesError

      // Simple random pairing (in real implementation, would use proper algorithms)
      // TODO: Implement power-pairing based on options.drawType
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5)
      const teamsPerDebate = round.tournament.preferences?.teams_in_debate || 4

      const debates = []
      for (let i = 0; i < shuffledTeams.length; i += teamsPerDebate) {
        const debateTeams = shuffledTeams.slice(i, i + teamsPerDebate)
        if (debateTeams.length === teamsPerDebate) {
          // Create debate
          const { data: debate, error: debateError } = await supabase
            .from('debates')
            .insert({
              round_id: roundId,
              venue_id: venues[Math.floor(i / teamsPerDebate)]?.id,
              bracket: 0,
              room_rank: Math.floor(i / teamsPerDebate) + 1
            })
            .select()
            .single()

          if (debateError) throw debateError

          // Create debate teams
          for (let j = 0; j < debateTeams.length; j++) {
            await supabase
              .from('debate_teams')
              .insert({
                debate_id: debate.id,
                team_id: debateTeams[j].id,
                side: j
              })
          }

          debates.push(debate)
        }
      }

      // Update round status
      await updateRoundStatus(roundId, { draw_status: 'draft' })
      
      // Reload draw
      await loadDraw(roundId)

      return debates
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate draw')
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Add motion to round
  const addMotion = async (roundId: string, motionText: string, infoSlide?: string) => {
    try {
      const { data, error } = await supabase
        .from('motions')
        .insert({
          round_id: roundId,
          text: motionText,
          info_slide: infoSlide,
          seq: 1
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (err) {
      console.error('Failed to add motion:', err)
      throw err
    }
  }

  // Auto-load rounds when tournament changes
  useEffect(() => {
    if (tournamentId) {
      loadRounds(tournamentId)
    }
  }, [tournamentId])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!tournamentId) return

    const channel = supabase
      .channel(`rounds:${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        loadRounds(tournamentId)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'debates'
      }, (payload) => {
        // Refresh current draw if this debate belongs to current round
        if (currentDraw && payload.new && typeof payload.new === 'object' && 'round_id' in payload.new) {
          const updatedRound = rounds.find(r => r.id === payload.new.round_id)
          if (updatedRound) {
            loadDraw(updatedRound.id)
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId, currentDraw, rounds])

  return {
    rounds,
    currentDraw,
    loading,
    error,
    loadRounds,
    loadDraw,
    createRound,
    updateRoundStatus,
    generateDraw,
    addMotion,
    refetch: () => tournamentId && loadRounds(tournamentId)
  }
}

export default useRounds

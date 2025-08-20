import { useEffect, useState } from 'react'
import { supabase } from '../../config/supabase'
import { useTournamentAdmin } from './TournamentAdminScope'
import type { Member, Round, SpeakerScore } from '../../types/db'

type User = {
  id: string
  full_name?: string | null
  email?: string | null
}

type Team = {
  id: string
  name: string
  institution?: string | null
}

type Match = {
  id: string
  round_id: string
  chair_judge?: string | null
}

type ExtendedMember = Member & {
  user: User
  team: Team
}

export default function SpeakerScoresAdmin() {
  const { tournamentId } = useTournamentAdmin()
  const [members, setMembers] = useState<ExtendedMember[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [scores, setScores] = useState<SpeakerScore[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRound, setSelectedRound] = useState<string>('')
  const [selectedMatch, setSelectedMatch] = useState<string>('')
  const [teamPreview, setTeamPreview] = useState<Array<{ teamId: string; teamName: string; total: number; rank: number; points: number }>>([])
  const [autoCalculated, setAutoCalculated] = useState(false)

  async function loadData() {
    if (!tournamentId) return
    setLoading(true)
    setError(null)
    try {
      // Load teams and members
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select(`
          id, name, institution,
          members!inner(
            id, user_id, team_id, role, total_points, average_points, rounds_participated,
            users!inner(id, full_name, email)
          )
        `)
        .eq('tournament_id', tournamentId)
      
      if (teamsErr) throw teamsErr

      // Flatten members with team and user data
      const allMembers: ExtendedMember[] = []
      teamsData?.forEach((team: any) => {
        team.members.forEach((member: any) => {
          allMembers.push({
            ...member,
            user: member.users,
            team: { id: team.id, name: team.name, institution: team.institution }
          })
        })
      })
      setMembers(allMembers)

      // Load rounds
      const { data: roundsData, error: roundsErr } = await supabase
        .from('rounds')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round_number')
      
      if (roundsErr) throw roundsErr
      setRounds(roundsData || [])

      // Load existing scores
      const { data: scoresData, error: scoresErr } = await supabase
        .from('speaker_scores')
        .select('*')
      
      if (scoresErr) throw scoresErr
      setScores(scoresData || [])

    } catch (err: any) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  async function loadMatches(roundId: string) {
    if (!roundId) {
      setMatches([])
      return
    }
    
    try {
      const { data: matchesData, error: matchesErr } = await supabase
        .from('matches')
        .select('*')
        .eq('round_id', roundId)
      
      if (matchesErr) throw matchesErr
      setMatches(matchesData || [])
    } catch (err: any) {
      console.error('Error loading matches:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [tournamentId])

  useEffect(() => {
    if (selectedRound) {
      loadMatches(selectedRound)
    }
  }, [selectedRound])

  useEffect(() => {
    // Reset auto-calculation state when match changes
    setAutoCalculated(false)
    setTeamPreview([])
  }, [selectedMatch])

  async function saveScore(memberId: string, points: number) {
    if (!selectedMatch || !selectedRound) {
      alert('Please select a round and match first')
      return
    }

    try {
      const { error } = await supabase
        .from('speaker_scores')
        .upsert({
          member_id: memberId,
          match_id: selectedMatch,
          round_id: selectedRound,
          points: points
        }, { 
          onConflict: 'member_id,match_id'
        })

      if (error) throw error
      
      // Reload scores and check if we can calculate team results
      await loadData()
      await calculateTeamResults()
    } catch (err: any) {
      alert(`Error saving score: ${err.message}`)
    }
  }

  async function calculateTeamResults() {
    if (!selectedMatch || !tournamentId) return

    try {
      // Get tournament format for points calculation
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('format')
        .eq('id', tournamentId)
        .single()

      const format = tournamentData?.format || 'BP'

      // Get all speaker scores for this match, grouped by team
      const { data: scoresData } = await supabase
        .from('speaker_scores')
        .select(`
          points,
          members!inner(
            team_id,
            teams!inner(name)
          )
        `)
        .eq('match_id', selectedMatch)

      if (!scoresData) return

      // Group scores by team and calculate totals
      const teamTotals = new Map<string, { name: string; total: number; count: number }>()
      
      scoresData.forEach((score: any) => {
        const teamId = score.members.team_id
        const teamName = score.members.teams.name
        const current = teamTotals.get(teamId) || { name: teamName, total: 0, count: 0 }
        current.total += score.points
        current.count += 1
        teamTotals.set(teamId, current)
      })

      // Only proceed if we have complete data (teams with 2 speakers each)
      const completeTeams = Array.from(teamTotals.entries())
        .filter(([_, data]) => data.count === 2)
        .map(([teamId, data]) => ({ teamId, ...data }))

      if (completeTeams.length < 2) {
        console.log('Not enough complete team scores to calculate results')
        return
      }

      // Sort teams by total score (highest first) and assign ranks
      completeTeams.sort((a, b) => b.total - a.total)
      
      // Calculate points based on tournament format and rank
      const calculatePoints = (format: string, rank: number): number => {
        if (format === 'BP' || format === 'AP') {
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

      // Update preview
      const preview = completeTeams.map((team, index) => ({
        teamId: team.teamId,
        teamName: team.name,
        total: team.total,
        rank: index + 1,
        points: calculatePoints(format, index + 1)
      }))
      setTeamPreview(preview)

      // Clear existing results for this match
      await supabase
        .from('results')
        .delete()
        .eq('match_id', selectedMatch)

      // Insert new results
      const results = completeTeams.map((team, index) => ({
        match_id: selectedMatch,
        team_id: team.teamId,
        rank: index + 1,
        points: calculatePoints(format, index + 1)
      }))

      const { error: resultsError } = await supabase
        .from('results')
        .insert(results)

      if (resultsError) throw resultsError

      setAutoCalculated(true)
      console.log('Team results calculated automatically:', results)
    } catch (err: any) {
      console.error('Error calculating team results:', err)
    }
  }

  function getScore(memberId: string): number | null {
    if (!selectedMatch) return null
    const score = scores.find(s => s.member_id === memberId && s.match_id === selectedMatch)
    return score ? score.points : null
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Speaker Scores</h2>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-md p-4">
          <p className="text-rose-300">{error}</p>
        </div>
      )}

      {/* Round and Match Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-zinc-900/60 border border-zinc-800 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Select Round
          </label>
          <select 
            value={selectedRound} 
            onChange={(e) => {
              setSelectedRound(e.target.value)
              setSelectedMatch('')
            }}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Choose a round...</option>
            {rounds.map(round => (
              <option key={round.id} value={round.id}>
                Round {round.round_number} {round.motion && `- ${round.motion.substring(0, 50)}...`}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Select Match
          </label>
          <select 
            value={selectedMatch} 
            onChange={(e) => setSelectedMatch(e.target.value)}
            disabled={!selectedRound}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="">Choose a match...</option>
            {matches.map((match, idx) => (
              <option key={match.id} value={match.id}>
                Match {idx + 1} {match.chair_judge && `(Judge: ${match.chair_judge})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Speakers Table */}
      {selectedMatch && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg">
          <div className="px-6 py-4 border-b border-zinc-700">
            <h3 className="text-lg font-medium text-white">Enter Speaker Scores</h3>
            <p className="text-sm text-zinc-400 mt-1">
              Round {rounds.find(r => r.id === selectedRound)?.round_number} - 
              Match {matches.findIndex(m => m.id === selectedMatch) + 1}
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900/60">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Speaker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Score (0-100)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-zinc-800 divide-y divide-zinc-700">
                {members.map((member) => {
                  const currentScore = getScore(member.id)
                  return (
                    <tr key={member.id} className="hover:bg-zinc-700/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-white">
                          {member.user.full_name || member.user.email || 'Unknown'}
                        </div>
                        <div className="text-sm text-zinc-400 capitalize">{member.role}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-white">{member.team.name}</div>
                        {member.team.institution && (
                          <div className="text-sm text-zinc-400">{member.team.institution}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          defaultValue={currentScore?.toString() || ''}
                          className="w-20 rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-center text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          id={`score-${member.id}`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => {
                            const input = document.getElementById(`score-${member.id}`) as HTMLInputElement
                            const points = parseFloat(input.value)
                            if (isNaN(points) || points < 0 || points > 100) {
                              alert('Please enter a valid score between 0 and 100')
                              return
                            }
                            saveScore(member.id, points)
                          }}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Results Preview */}
      {selectedMatch && teamPreview.length > 0 && (
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg">
          <div className="px-6 py-4 border-b border-zinc-700">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              🏆 Auto-Calculated Team Results
              {autoCalculated && (
                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                  Saved to Results
                </span>
              )}
            </h3>
            <p className="text-sm text-zinc-400 mt-1">
              Teams ranked by total speaker scores
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-900/60">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Total Score
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody className="bg-zinc-800 divide-y divide-zinc-700">
                {teamPreview.map((team) => (
                  <tr key={team.teamId} className="hover:bg-zinc-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${
                          team.rank === 1 ? 'bg-yellow-500' :
                          team.rank === 2 ? 'bg-gray-400' :
                          team.rank === 3 ? 'bg-orange-600' :
                          'bg-zinc-600'
                        }`}>
                          {team.rank}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-white">{team.teamName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-white font-mono">{team.total.toFixed(1)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-white font-bold">{team.points}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Current Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
          <div className="text-2xl font-bold text-blue-400">{members.length}</div>
          <div className="text-zinc-400">Total Speakers</div>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
          <div className="text-2xl font-bold text-green-400">{rounds.length}</div>
          <div className="text-zinc-400">Total Rounds</div>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
          <div className="text-2xl font-bold text-purple-400">{scores.length}</div>
          <div className="text-zinc-400">Scores Entered</div>
        </div>
      </div>
    </div>
  )
}

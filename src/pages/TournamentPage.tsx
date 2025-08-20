
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../config/supabase'
import type { Tournament, Team, Member, Round, SpeakerStanding } from '../types/db'

type User = {
  id: string
  full_name?: string | null
  email?: string | null
}

type TabType = 'overview' | 'teams' | 'speakers' | 'motions' | 'participants' | 'results'

export default function TournamentPage() {
  const { id } = useParams()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [speakerStandings, setSpeakerStandings] = useState<SpeakerStanding[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [results, setResults] = useState<Array<{id: string; match_id: string; team_id: string; round_id?: string; points: number; rank: number}>>([])
  const [users, setUsers] = useState<Record<string, User>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  useEffect(() => {
    async function load() {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        // Tournament
        const { data: tData, error: tErr } = await supabase
          .from('tournaments')
          .select('id, name, description, created_at')
          .eq('id', id)
          .maybeSingle()
        if (tErr) throw tErr
        setTournament(tData as Tournament)

        // Teams
        const { data: teamData, error: teamErr } = await supabase
          .from('teams')
          .select('*')
          .eq('tournament_id', id)
        if (teamErr) throw teamErr
        setTeams(teamData || [])

        // Members
        const { data: memberData, error: memberErr } = await supabase
          .from('members')
          .select('*')
          .in('team_id', (teamData || []).map(t => t.id))
        if (memberErr) throw memberErr
        setMembers(memberData || [])

        // Speaker Standings (from view) - only speakers with scores
        const { data: standingsData, error: standingsErr } = await supabase
          .from('speaker_standings')
          .select('*')
          .eq('tournament_id', id)
        if (standingsErr) throw standingsErr
        
        // Create speaker list from ALL members - everyone can be a speaker
        const speakerMembers = (memberData || []) // All members are potential speakers
        const speakersWithStandings = speakerMembers.map(member => {
          const team = (teamData || []).find(t => t.id === member.team_id)
          // Check if this speaker has standings data
          const standingData = (standingsData || []).find(s => s.member_id === member.id)
          
          if (standingData) {
            // Use data from speaker_standings view
            return standingData
          } else {
            // Create default entry for speaker without scores
            return {
              id: member.id,
              member_id: member.id,
              tournament_id: id,
              speaker_name: null, // Will be filled from user data
              team_name: team?.name || 'Unknown Team',
              institution: team?.institution,
              total_points: 0,
              average_points: 0,
              standard_deviation: 0,
              rounds_participated: 0,
              round_scores: []
            }
          }
        })
        
        setSpeakerStandings(speakersWithStandings)

        // Rounds (for motions)
        const { data: roundData, error: roundErr } = await supabase
          .from('rounds')
          .select('*')
          .eq('tournament_id', id)
        if (roundErr) throw roundErr
        setRounds(roundData || [])

        // Results (for team standings) - filter by tournament teams
        const teamIds = (teamData || []).map(t => t.id)
        let resultData: any[] = []
        if (teamIds.length > 0) {
          const { data, error: resultErr } = await supabase
            .from('results')
            .select('id, match_id, team_id, round_id, points, rank')
            .in('team_id', teamIds)
          if (resultErr) throw resultErr
          resultData = data || []
        }
        setResults(resultData)

        // Users for participants
        const userIds = (memberData || []).map((m: Member) => m.user_id)
        let userMap: Record<string, User> = {}
        if (userIds.length > 0) {
          const { data: userData, error: userErr } = await supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', userIds)
          if (userErr) throw userErr
          userMap = Object.fromEntries((userData || []).map((u: User) => [u.id, u]))
        }
        setUsers(userMap)

      } catch (e: any) {
        setError(e.message || String(e))
      }
      setLoading(false)
    }
    load()
    // no-op cleanup
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-zinc-900">
      <main className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading tournament...</p>
          </div>
        </div>
      </main>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-zinc-900">
      <main className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-rose-400 text-6xl mb-4">⚠️</div>
            <p className="text-rose-400 text-xl">Error: {error}</p>
          </div>
        </div>
      </main>
    </div>
  )

  if (!tournament) return (
    <div className="min-h-screen bg-zinc-900">
      <main className="mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="text-zinc-400 text-6xl mb-4">🔍</div>
            <p className="text-white text-xl">Tournament not found</p>
          </div>
        </div>
      </main>
    </div>
  )

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview', icon: '🏠' },
    { id: 'teams' as TabType, label: 'Team Tab', icon: '👥' },
    { id: 'speakers' as TabType, label: 'Speaker Tab', icon: '🎤' },
    { id: 'motions' as TabType, label: 'Motions', icon: '📝' },
    { id: 'participants' as TabType, label: 'Participants', icon: '👤' },
    { id: 'results' as TabType, label: 'Results', icon: '🏆' },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-4">
                  👋 Welcome to {tournament.name}
                </h2>
                {tournament.description && (
                  <p className="text-lg text-zinc-300 max-w-4xl mx-auto leading-relaxed">
                    {tournament.description}
                  </p>
                )}
              </div>
            </div>

            {/* Tournament Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-6 text-center">
                <div className="text-3xl font-bold text-blue-400">{teams.length}</div>
                <div className="text-zinc-400 font-medium">Teams</div>
              </div>
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-6 text-center">
                <div className="text-3xl font-bold text-green-400">{speakerStandings.length}</div>
                <div className="text-zinc-400 font-medium">Active Speakers</div>
              </div>
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-6 text-center">
                <div className="text-3xl font-bold text-purple-400">{rounds.length}</div>
                <div className="text-zinc-400 font-medium">Rounds</div>
              </div>
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-6 text-center">
                <div className="text-3xl font-bold text-orange-400">{members.length}</div>
                <div className="text-zinc-400 font-medium">Participants</div>
              </div>
            </div>

            {/* Tournament Information */}
            <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-white mb-6">Tournament Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-semibold text-zinc-300 mb-3">Tournament Staff</h4>
                  <div className="space-y-2 text-zinc-400">
                    <p><strong>Tabulation:</strong> Tournament Admin</p>
                    <p><strong>Organisation:</strong> Debate Tab System</p>
                    <p><strong>Adjudication:</strong> Chief Adjudicator</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-300 mb-3">Quick Links</h4>
                  <div className="space-y-2">
                    <Link to="#" className="block text-indigo-400 hover:text-indigo-300 transition-colors">
                      📋 Technical Guide
                    </Link>
                    <Link to="#" className="block text-indigo-400 hover:text-indigo-300 transition-colors">
                      📅 Tournament Rundown
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'teams':
        return (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-white mb-6">Team Standings</h3>
            {teams.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👥</div>
                <p className="text-zinc-400 text-lg">No teams registered yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-zinc-600">
                      <th className="text-left py-3 px-4 font-semibold text-zinc-300">Rank</th>
                      <th className="text-left py-3 px-4 font-semibold text-zinc-300">Team</th>
                      <th className="text-left py-3 px-4 font-semibold text-zinc-300">Institution</th>
                      {/* Dynamic round headers */}
                      {rounds.length > 0 && rounds.map((round) => (
                        <th key={round.id} className="text-center py-3 px-3 font-semibold text-zinc-300">R{round.round_number}</th>
                      ))}
                      <th className="text-center py-3 px-4 font-semibold text-zinc-300">Total Points</th>
                      <th className="text-center py-3 px-4 font-semibold text-zinc-300">Avg Speaker Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams
                      .map(team => {
                        // Calculate team statistics
                        const teamResults = results.filter(r => r.team_id === team.id)
                        const totalPoints = teamResults.reduce((sum, r) => sum + r.points, 0)
                        const teamSpeakers = speakerStandings.filter(s => s.team_name === team.name)
                        const avgSpeakerScore = teamSpeakers.length > 0 
                          ? (teamSpeakers.reduce((sum, s) => sum + (s.average_points || 0), 0) / teamSpeakers.length)
                          : 0

                        // Get results per round for this team
                        const roundResults = rounds.map((round) => {
                          const roundResult = teamResults.find(result => result.round_id === round.id)
                          return roundResult ? { points: roundResult.points, rank: roundResult.rank } : null
                        })

                        return { 
                          ...team, 
                          totalPoints, 
                          avgSpeakerScore,
                          roundResults,
                          matchesPlayed: teamResults.length
                        }
                      })
                      .sort((a, b) => {
                        // Sort by total points first, then by average speaker score
                        if (b.totalPoints !== a.totalPoints) {
                          return b.totalPoints - a.totalPoints
                        }
                        return b.avgSpeakerScore - a.avgSpeakerScore
                      })
                      .map((team, index) => (
                        <tr key={team.id} className="border-b border-zinc-700 hover:bg-zinc-700 transition-colors">
                          <td className="py-3 px-4 font-medium text-white">{index + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-white">{team.name}</div>
                          </td>
                          <td className="py-3 px-4 text-zinc-400">{team.institution || '-'}</td>
                          {/* Round results for this team */}
                          {rounds.length > 0 && rounds.map((round, roundIndex) => {
                            const roundResult = team.roundResults[roundIndex]
                            return (
                              <td key={round.id} className="py-3 px-3 text-center text-sm">
                                {roundResult ? (
                                  <div className="space-y-1">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                                      roundResult.points === 3 ? 'bg-yellow-900 text-yellow-300' :
                                      roundResult.points === 2 ? 'bg-gray-900 text-gray-300' :
                                      roundResult.points === 1 ? 'bg-orange-900 text-orange-300' :
                                      'bg-red-900 text-red-300'
                                    }`}>
                                      {roundResult.points}pts
                                    </span>
                                    <div className="text-xs text-zinc-500">#{roundResult.rank}</div>
                                  </div>
                                ) : (
                                  <span className="text-zinc-500">—</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="py-3 px-4 text-center">
                            <div className="font-bold text-white">{team.totalPoints}</div>
                            <div className="text-xs text-zinc-400">{team.matchesPlayed} matches</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="font-medium text-white">
                              {team.avgSpeakerScore > 0 ? team.avgSpeakerScore.toFixed(1) : '-'}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

      case 'speakers':
        return (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-white mb-6">Speaker Standings</h3>
            {speakerStandings.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎤</div>
                <p className="text-zinc-400 text-lg">No speakers available yet</p>
                <p className="text-zinc-500 text-sm mt-2">Speakers will appear when team members are registered</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-zinc-600">
                      <th className="text-left py-3 px-4 font-semibold text-zinc-300">Rank</th>
                      <th className="text-left py-3 px-4 font-semibold text-zinc-300">Speaker</th>
                      <th className="text-left py-3 px-4 font-semibold text-zinc-300">Team</th>
                      {/* Dynamic round headers - only show if there are actual rounds with scores */}
                      {speakerStandings.some(s => s.rounds_participated > 0) && Array.from({length: Math.max(...speakerStandings.map(s => s.rounds_participated))}, (_, i) => (
                        <th key={i} className="text-center py-3 px-3 font-semibold text-zinc-300">R{i + 1}</th>
                      ))}
                      <th className="text-center py-3 px-4 font-semibold text-zinc-300">Total</th>
                      <th className="text-center py-3 px-4 font-semibold text-zinc-300">Avg</th>
                      {speakerStandings.some(s => s.rounds_participated > 0) && (
                        <th className="text-center py-3 px-4 font-semibold text-zinc-300">Std Dev</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {speakerStandings
                      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0)) // Sort by total points descending
                      .map((speaker, index) => {
                      const maxRounds = Math.max(...speakerStandings.map(s => s.rounds_participated))
                      const member = members.find(m => m.id === speaker.member_id)
                      const user = member ? users[member.user_id] : null
                      const speakerName = speaker.speaker_name || user?.full_name || user?.email || 'Unknown Speaker'
                      
                      return (
                        <tr key={speaker.id} className="border-b border-zinc-700 hover:bg-zinc-700 transition-colors">
                          <td className="py-3 px-4 font-medium text-white">{index + 1}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-white">{speakerName}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-zinc-400">{speaker.team_name}</div>
                            {speaker.institution && (
                              <div className="text-xs text-zinc-500">{speaker.institution}</div>
                            )}
                          </td>
                          {/* Round scores - only show if there are actual rounds with scores */}
                          {speakerStandings.some(s => s.rounds_participated > 0) && Array.from({length: maxRounds}, (_, i) => (
                            <td key={i} className="py-3 px-3 text-center text-sm">
                              {speaker.round_scores && speaker.round_scores[i] ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-900 text-blue-300">
                                  {speaker.round_scores[i]}
                                </span>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </td>
                          ))}
                          <td className="py-3 px-4 text-center font-bold text-white">
                            {speaker.total_points || '—'}
                          </td>
                          <td className="py-3 px-4 text-center font-medium text-zinc-300">
                            {speaker.rounds_participated > 0 ? speaker.average_points.toFixed(2) : '—'}
                          </td>
                          {speakerStandings.some(s => s.rounds_participated > 0) && (
                            <td className="py-3 px-4 text-center text-sm text-zinc-400">
                              {speaker.rounds_participated > 1 ? speaker.standard_deviation.toFixed(2) : '—'}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                
                {/* Statistics Summary */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-zinc-700 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">{speakerStandings.length}</div>
                    <div className="text-sm text-zinc-400">Total Speakers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {speakerStandings.length > 0 ? 
                        (speakerStandings.reduce((sum, s) => sum + s.average_points, 0) / speakerStandings.length).toFixed(2) 
                        : '0.00'
                      }
                    </div>
                    <div className="text-sm text-zinc-400">Overall Average</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {speakerStandings.length > 0 ? Math.max(...speakerStandings.map(s => s.rounds_participated)) : 0}
                    </div>
                    <div className="text-sm text-zinc-400">Max Rounds</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 'motions':
        return (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-white mb-6">Motions</h3>
            {rounds.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📝</div>
                <p className="text-zinc-400 text-lg">No motions available yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rounds.map(round => (
                  <div key={round.id} className="border border-zinc-600 rounded-lg p-6 hover:bg-zinc-700 transition-colors">
                    <div className="flex items-start space-x-4">
                      <div className="bg-blue-900 text-blue-300 px-3 py-1 rounded-full text-sm font-medium">
                        Round {round.round_number}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-lg leading-relaxed">
                          {round.motion || <span className="text-zinc-500 italic">Motion not set yet</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      case 'participants':
        return (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-white mb-6">Participants List</h3>
            {members.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">👤</div>
                <p className="text-zinc-400 text-lg">No participants registered yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-zinc-600">
                      <th className="text-left py-3 px-4 font-semibold text-zinc-300">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-zinc-300">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-zinc-300">Team</th>
                      <th className="text-left py-3 px-4 font-semibold text-zinc-300">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(member => {
                      const user = users[member.user_id]
                      const team = teams.find(t => t.id === member.team_id)
                      const name = user?.full_name || user?.email || member.user_id
                      return (
                        <tr key={member.id} className="border-b border-zinc-700 hover:bg-zinc-700 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-white">{name}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900 text-blue-300">
                              {member.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-zinc-400">{team?.name || '-'}</td>
                          <td className="py-3 px-4 text-zinc-400">{user?.email || '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )

      case 'results':
        return (
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl shadow-lg p-8">
            <h3 className="text-2xl font-bold text-white mb-6">Match Results</h3>
            {results.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🏆</div>
                <p className="text-zinc-400 text-lg">No results available yet</p>
                <p className="text-zinc-500 text-sm mt-2">Results will appear when matches are completed</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Group results by round */}
                {rounds.map(round => {
                  const roundResults = results.filter(r => r.round_id === round.id)
                  if (roundResults.length === 0) return null

                  return (
                    <div key={round.id} className="bg-zinc-700 rounded-lg p-6">
                      <h4 className="text-xl font-semibold text-white mb-4">
                        Round {round.round_number}
                        {round.motion && (
                          <div className="text-sm font-normal text-zinc-300 mt-1">
                            Motion: {round.motion}
                          </div>
                        )}
                      </h4>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-zinc-600">
                              <th className="text-left py-3 px-4 font-semibold text-zinc-300">Rank</th>
                              <th className="text-left py-3 px-4 font-semibold text-zinc-300">Team</th>
                              <th className="text-left py-3 px-4 font-semibold text-zinc-300">Institution</th>
                              <th className="text-center py-3 px-4 font-semibold text-zinc-300">Points</th>
                              <th className="text-center py-3 px-4 font-semibold text-zinc-300">Avg Speaker Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {roundResults
                              .sort((a, b) => a.rank - b.rank)
                              .map((result) => {
                                const team = teams.find(t => t.id === result.team_id)
                                const teamSpeakers = speakerStandings.filter(s => s.team_name === team?.name)
                                const avgSpeakerScore = teamSpeakers.length > 0 
                                  ? (teamSpeakers.reduce((sum, s) => sum + (s.average_points || 0), 0) / teamSpeakers.length)
                                  : 0

                                return (
                                  <tr key={result.id} className="border-b border-zinc-600 hover:bg-zinc-600 transition-colors">
                                    <td className="py-3 px-4">
                                      <div className="flex items-center">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${
                                          result.rank === 1 ? 'bg-yellow-500' :
                                          result.rank === 2 ? 'bg-gray-400' :
                                          result.rank === 3 ? 'bg-orange-600' :
                                          'bg-zinc-600'
                                        }`}>
                                          {result.rank}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="font-medium text-white">{team?.name || 'Unknown Team'}</div>
                                    </td>
                                    <td className="py-3 px-4 text-zinc-400">{team?.institution || '-'}</td>
                                    <td className="py-3 px-4 text-center">
                                      <span className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium ${
                                        result.points === 3 ? 'bg-yellow-900 text-yellow-300' :
                                        result.points === 2 ? 'bg-gray-900 text-gray-300' :
                                        result.points === 1 ? 'bg-orange-900 text-orange-300' :
                                        'bg-red-900 text-red-300'
                                      }`}>
                                        {result.points} pts
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-center text-white">
                                      {avgSpeakerScore > 0 ? avgSpeakerScore.toFixed(1) : '-'}
                                    </td>
                                  </tr>
                                )
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}

                {/* Overall Statistics */}
                <div className="bg-zinc-700 rounded-lg p-6">
                  <h4 className="text-xl font-semibold text-white mb-4">Tournament Statistics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-zinc-800 border border-zinc-600 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-400">{rounds.length}</div>
                      <div className="text-zinc-400">Total Rounds</div>
                    </div>
                    <div className="bg-zinc-800 border border-zinc-600 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-400">{results.length}</div>
                      <div className="text-zinc-400">Completed Matches</div>
                    </div>
                    <div className="bg-zinc-800 border border-zinc-600 rounded-lg p-4">
                      <div className="text-2xl font-bold text-purple-400">{teams.length}</div>
                      <div className="text-zinc-400">Participating Teams</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      {/* Header */}
      <div className="bg-zinc-800 border-b border-zinc-700 shadow-lg">
        <div className="mx-auto max-w-7xl px-4">
          <div className="py-6">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-white mb-2">{tournament.name}</h1>
              <p className="text-zinc-400">Powered by Debate Tab System</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-zinc-800 border-b border-zinc-700 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        {renderTabContent()}
      </main>

      {/* Footer */}
      <footer className="bg-zinc-800 border-t border-zinc-700 text-zinc-300 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-lg font-semibold mb-4">Tournament System</h4>
              <p className="text-zinc-400">
                This tournament runs on Debate Tab System, an open-source project for debate tournament management.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <div className="space-y-2">
                <Link to="#" className="block text-zinc-400 hover:text-white transition-colors">
                  Technical Support
                </Link>
                <Link to="#" className="block text-zinc-400 hover:text-white transition-colors">
                  Documentation
                </Link>
                <Link to="#" className="block text-zinc-400 hover:text-white transition-colors">
                  Contact Admin
                </Link>
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Tournament Info</h4>
              <div className="text-zinc-400 space-y-1">
                <p>Created: {tournament.created_at ? new Date(tournament.created_at).toLocaleDateString() : 'Unknown'}</p>
                <p>Tournament ID: {tournament.id.slice(0, 8)}...</p>
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-700 mt-8 pt-8 text-center">
            <p className="text-zinc-400">
              © 2025 Debate Tab System. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

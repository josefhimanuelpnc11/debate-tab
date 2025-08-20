import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import useTournament from '../hooks/useTournament'
import useStandings from '../hooks/useStandings'
import useRounds from '../hooks/useRounds'
import { SIDE_NAMES } from '../types/db'

const TournamentDashboard: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const { tournament, currentRound, teams, adjudicators, loading: tournamentLoading, error } = useTournament(slug)
  const { teamStandings, speakerStandings, loading: standingsLoading } = useStandings(tournament?.id)
  const { rounds, currentDraw, loading: roundsLoading } = useRounds(tournament?.id)
  const [activeTab, setActiveTab] = useState<'overview' | 'draw' | 'standings' | 'rounds'>('overview')

  useEffect(() => {
    if (currentRound?.id) {
      // Auto-load current draw if there's a current round
      // This would be handled by the useRounds hook
    }
  }, [currentRound])

  if (tournamentLoading || !tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Tournament Not Found</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link to="/" className="text-blue-600 hover:text-blue-700">
            ← Back to tournaments
          </Link>
        </div>
      </div>
    )
  }

  const formatName = tournament.format || 'BP'
  const sideNames = SIDE_NAMES[formatName as keyof typeof SIDE_NAMES] || SIDE_NAMES.BP

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div>
              <nav className="flex" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-4">
                  <li>
                    <Link to="/" className="text-gray-400 hover:text-gray-500">
                      Tournaments
                    </Link>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <svg className="flex-shrink-0 h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="ml-4 text-sm font-medium text-gray-500">{tournament.name}</span>
                    </div>
                  </li>
                </ol>
              </nav>
              <div className="mt-2">
                <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
                {tournament.short_name && (
                  <p className="text-gray-600">{tournament.short_name}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                tournament.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {tournament.active ? 'Active' : 'Inactive'}
              </span>
              
              <Link
                to={`/admin/tournament/${tournament.slug}`}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Admin Panel
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      {currentRound && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6 text-sm">
                <div>
                  <span className="text-blue-600 font-medium">Current Round: </span>
                  <span className="text-blue-900">{currentRound.name}</span>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Status: </span>
                  <span className="text-blue-900 capitalize">{currentRound.draw_status}</span>
                </div>
                <div>
                  <span className="text-blue-600 font-medium">Stage: </span>
                  <span className="text-blue-900 capitalize">{currentRound.stage}</span>
                </div>
              </div>
              
              {currentRound.starts_at && (
                <div className="text-sm text-blue-600">
                  Starts: {new Date(currentRound.starts_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {[
              { id: 'overview', name: 'Overview' },
              { id: 'draw', name: 'Draw' },
              { id: 'standings', name: 'Standings' },
              { id: 'rounds', name: 'Rounds' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Stats Cards */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Teams</dt>
                    <dd className="text-lg font-medium text-gray-900">{teams.length}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Adjudicators</dt>
                    <dd className="text-lg font-medium text-gray-900">{adjudicators.length}</dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Rounds</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {rounds.filter(r => r.completed).length} / {rounds.length}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Format</dt>
                    <dd className="text-lg font-medium text-gray-900">{tournament.format}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'draw' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {currentRound ? `${currentRound.name} Draw` : 'No Current Round'}
              </h2>
              {currentRound && (
                <div className="flex space-x-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    currentRound.draw_status === 'released' ? 'bg-green-100 text-green-800' :
                    currentRound.draw_status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                    currentRound.draw_status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {currentRound.draw_status === 'none' ? 'Not Generated' : currentRound.draw_status}
                  </span>
                </div>
              )}
            </div>

            {roundsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : currentDraw?.debates && currentDraw.debates.length > 0 ? (
              <div className="space-y-4">
                {currentDraw.debates.map((debate, index) => (
                  <div key={debate.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">
                        {debate.venue?.display_name || debate.venue?.name || `Room ${index + 1}`}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Bracket: {debate.bracket}</span>
                        <span>Importance: {debate.importance}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {debate.debate_teams.map((debateTeam, sideIndex) => (
                        <div key={debateTeam.id} className="text-center">
                          <div className="text-sm font-medium text-gray-600 mb-1">
                            {sideNames[sideIndex] || `Side ${sideIndex + 1}`}
                          </div>
                          <div className="bg-gray-50 rounded-md p-3">
                            <div className="font-medium">{debateTeam.team.short_name}</div>
                            {debateTeam.team.institution && (
                              <div className="text-xs text-gray-500 mt-1">
                                {debateTeam.team.institution.name}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No draw available</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {currentRound ? 'The draw has not been generated yet.' : 'No current round set.'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'standings' && (
          <div className="space-y-8">
            {/* Team Standings */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Team Standings</h2>
              {standingsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wins</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speaker Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {teamStandings.map((team, index) => (
                        <tr key={team.team_id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{team.team_name}</div>
                              {team.institution_name && (
                                <div className="text-sm text-gray-500">{team.institution_name}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {team.wins}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {team.total_speaker_score.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {team.average_speaker_score.toFixed(1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Speaker Standings */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Speaker Standings</h2>
              {standingsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                </div>
              ) : (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speaker</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Average</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Speeches</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {speakerStandings.map((speaker, index) => (
                        <tr key={speaker.speaker_id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{speaker.speaker_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm text-gray-900">{speaker.team_name}</div>
                              {speaker.institution_name && (
                                <div className="text-sm text-gray-500">{speaker.institution_name}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {speaker.total_score.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {speaker.average_score.toFixed(1)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {speaker.speeches_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rounds' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Rounds</h2>
            {roundsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {rounds.map((round) => (
                  <div key={round.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{round.name}</h3>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                          <span>Stage: {round.stage}</span>
                          <span>Draw: {round.draw_status}</span>
                          {round.starts_at && (
                            <span>Starts: {new Date(round.starts_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          round.completed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {round.completed ? 'Completed' : 'In Progress'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default TournamentDashboard

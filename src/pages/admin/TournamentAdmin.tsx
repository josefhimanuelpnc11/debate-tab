import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import useTournament from '../../hooks/useTournament'
import useRounds from '../../hooks/useRounds'

const TournamentAdmin: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const { tournament, teams, adjudicators, loading, error, createSampleTournament } = useTournament(slug)
  const { rounds, generateDraw, createRound, updateRoundStatus, addMotion } = useRounds(tournament?.id)
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'rounds' | 'settings'>('overview')
  const [showCreateRound, setShowCreateRound] = useState(false)
  const [newRoundData, setNewRoundData] = useState({
    name: '',
    abbreviation: '',
    stage: 'preliminary' as 'preliminary' | 'elimination',
    draw_type: 'power_paired' as 'random' | 'manual' | 'round_robin' | 'power_paired' | 'elimination' | 'seeded'
  })

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tournament) return

    try {
      await createRound(tournament.id, newRoundData)
      setShowCreateRound(false)
      setNewRoundData({
        name: '',
        abbreviation: '',
        stage: 'preliminary',
        draw_type: 'power_paired'
      })
    } catch (err) {
      console.error('Failed to create round:', err)
    }
  }

  const handleGenerateDraw = async (roundId: string) => {
    try {
      await generateDraw(roundId, { drawType: 'random' })
    } catch (err) {
      console.error('Failed to generate draw:', err)
    }
  }

  const handleCreateSampleData = async () => {
    try {
      await createSampleTournament()
      // Refresh tournament data
      window.location.reload()
    } catch (err) {
      console.error('Failed to create sample data:', err)
    }
  }

  if (loading || !tournament) {
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
                      <Link to={`/tournament/${tournament.slug}`} className="ml-4 text-gray-400 hover:text-gray-500">
                        {tournament.name}
                      </Link>
                    </div>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <svg className="flex-shrink-0 h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="ml-4 text-sm font-medium text-gray-500">Admin</span>
                    </div>
                  </li>
                </ol>
              </nav>
              <div className="mt-2">
                <h1 className="text-2xl font-bold text-gray-900">Tournament Administration</h1>
                <p className="text-gray-600">{tournament.name}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                to={`/tournament/${tournament.slug}`}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Public View
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {[
              { id: 'overview', name: 'Overview' },
              { id: 'participants', name: 'Participants' },
              { id: 'rounds', name: 'Rounds' },
              { id: 'settings', name: 'Settings' }
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
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleCreateSampleData}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  Create Sample Data
                </button>
                <button
                  onClick={() => setShowCreateRound(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Create New Round
                </button>
                <Link
                  to={`/admin/tournament/${tournament.slug}/teams/new`}
                  className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors text-center"
                >
                  Add Teams
                </Link>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="space-y-6">
            {/* Teams */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Teams ({teams.length})</h2>
                <Link
                  to={`/admin/tournament/${tournament.slug}/teams/new`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  Add Team
                </Link>
              </div>
              <div className="divide-y divide-gray-200">
                {teams.slice(0, 10).map((team) => (
                  <div key={team.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{team.short_name}</div>
                      <div className="text-sm text-gray-500">{team.long_name}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">{team.team_type}</span>
                      <button className="text-blue-600 hover:text-blue-700 text-sm">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
              {teams.length > 10 && (
                <div className="px-6 py-3 bg-gray-50 text-center">
                  <Link
                    to={`/admin/tournament/${tournament.slug}/teams`}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    View all {teams.length} teams
                  </Link>
                </div>
              )}
            </div>

            {/* Adjudicators */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Adjudicators ({adjudicators.length})</h2>
                <Link
                  to={`/admin/tournament/${tournament.slug}/adjudicators/new`}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  Add Adjudicator
                </Link>
              </div>
              <div className="divide-y divide-gray-200">
                {adjudicators.slice(0, 10).map((adj) => (
                  <div key={adj.id} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{adj.name}</div>
                      <div className="text-sm text-gray-500">
                        Base Score: {adj.base_score} 
                        {adj.trainee && ' • Trainee'}
                        {adj.breaking && ' • Breaking'}
                        {adj.adj_core && ' • Core'}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="text-blue-600 hover:text-blue-700 text-sm">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
              {adjudicators.length > 10 && (
                <div className="px-6 py-3 bg-gray-50 text-center">
                  <Link
                    to={`/admin/tournament/${tournament.slug}/adjudicators`}
                    className="text-blue-600 hover:text-blue-700 text-sm"
                  >
                    View all {adjudicators.length} adjudicators
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rounds' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Rounds</h2>
              <button
                onClick={() => setShowCreateRound(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Round
              </button>
            </div>

            <div className="space-y-4">
              {rounds.map((round) => (
                <div key={round.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{round.name}</h3>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                        <span>Stage: {round.stage}</span>
                        <span>Draw: {round.draw_status}</span>
                        <span>Type: {round.draw_type}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        round.completed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {round.completed ? 'Completed' : 'In Progress'}
                      </span>
                      
                      {round.draw_status === 'none' && (
                        <button
                          onClick={() => handleGenerateDraw(round.id)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Generate Draw
                        </button>
                      )}
                      
                      {round.draw_status === 'draft' && (
                        <button
                          onClick={() => updateRoundStatus(round.id, { draw_status: 'confirmed' })}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Confirm Draw
                        </button>
                      )}
                      
                      {round.draw_status === 'confirmed' && (
                        <button
                          onClick={() => updateRoundStatus(round.id, { draw_status: 'released' })}
                          className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                        >
                          Release Draw
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Tournament Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tournament Name</label>
                <input
                  type="text"
                  value={tournament.name}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Format</label>
                <input
                  type="text"
                  value={tournament.format}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  tournament.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {tournament.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Round Modal */}
      {showCreateRound && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Round</h3>
              <form onSubmit={handleCreateRound} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Round Name</label>
                  <input
                    type="text"
                    required
                    value={newRoundData.name}
                    onChange={(e) => setNewRoundData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Round 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Abbreviation</label>
                  <input
                    type="text"
                    value={newRoundData.abbreviation}
                    onChange={(e) => setNewRoundData(prev => ({ ...prev, abbreviation: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., R1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stage</label>
                  <select
                    value={newRoundData.stage}
                    onChange={(e) => setNewRoundData(prev => ({ ...prev, stage: e.target.value as 'preliminary' | 'elimination' }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="preliminary">Preliminary</option>
                    <option value="elimination">Elimination</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Draw Type</label>
                  <select
                    value={newRoundData.draw_type}
                    onChange={(e) => setNewRoundData(prev => ({ ...prev, draw_type: e.target.value as any }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="random">Random</option>
                    <option value="power_paired">Power Paired</option>
                    <option value="manual">Manual</option>
                    <option value="round_robin">Round Robin</option>
                    <option value="elimination">Elimination</option>
                    <option value="seeded">Seeded</option>
                  </select>
                </div>
                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateRound(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Create Round
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TournamentAdmin

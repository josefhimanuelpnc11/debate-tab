import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../config/supabase'
import type { Team, Speaker, Institution } from '../../types/db'

const TeamsAdmin: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const [teams, setTeams] = useState<(Team & { speakers: Speaker[], institution?: Institution })[]>([])
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [tournament, setTournament] = useState<any>(null)

  const [teamForm, setTeamForm] = useState({
    short_name: '',
    long_name: '',
    institution_id: '',
    team_type: 'normal' as 'normal' | 'swing' | 'bye' | 'composite',
    use_institution_prefix: true,
    speakers: [
      { name: '', email: '', phone: '' },
      { name: '', email: '', phone: '' }
    ]
  })

  useEffect(() => {
    loadData()
  }, [slug])

  const loadData = async () => {
    if (!slug) return

    try {
      setLoading(true)
      
      // Load tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('slug', slug)
        .single()

      if (tournamentError) throw tournamentError
      setTournament(tournamentData)

      // Load teams with speakers and institutions
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          *,
          speakers (*),
          institutions (*)
        `)
        .eq('tournament_id', tournamentData.id)
        .order('short_name')

      if (teamsError) throw teamsError
      setTeams(teamsData || [])

      // Load institutions
      const { data: institutionsData, error: institutionsError } = await supabase
        .from('institutions')
        .select('*')
        .order('name')

      if (institutionsError) throw institutionsError
      setInstitutions(institutionsData || [])

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tournament) return

    try {
      // Create team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournament.id,
          short_name: teamForm.short_name,
          long_name: teamForm.long_name,
          institution_id: teamForm.institution_id || null,
          team_type: teamForm.team_type,
          use_institution_prefix: teamForm.use_institution_prefix
        })
        .select()
        .single()

      if (teamError) throw teamError

      // Create speakers
      for (const speaker of teamForm.speakers) {
        if (speaker.name) {
          const { error: speakerError } = await supabase
            .from('speakers')
            .insert({
              tournament_id: tournament.id,
              team_id: teamData.id,
              name: speaker.name,
              email: speaker.email || null,
              phone: speaker.phone || null
            })

          if (speakerError) throw speakerError
        }
      }

      // Reset form
      setTeamForm({
        short_name: '',
        long_name: '',
        institution_id: '',
        team_type: 'normal',
        use_institution_prefix: true,
        speakers: [
          { name: '', email: '', phone: '' },
          { name: '', email: '', phone: '' }
        ]
      })
      setShowAddTeam(false)
      
      // Reload data
      loadData()
    } catch (err: any) {
      console.error('Error creating team:', err)
      setError(err.message)
    }
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? This will also delete all associated speakers.')) {
      return
    }

    try {
      // Delete speakers first
      const { error: speakersError } = await supabase
        .from('speakers')
        .delete()
        .eq('team_id', teamId)

      if (speakersError) throw speakersError

      // Delete team
      const { error: teamError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId)

      if (teamError) throw teamError

      // Reload data
      loadData()
    } catch (err: any) {
      console.error('Error deleting team:', err)
      setError(err.message)
    }
  }

  const updateSpeaker = (index: number, field: string, value: string) => {
    setTeamForm(prev => ({
      ...prev,
      speakers: prev.speakers.map((speaker, i) => 
        i === index ? { ...speaker, [field]: value } : speaker
      )
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error || 'Tournament not found'}</p>
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
                    <Link to="/" className="text-gray-400 hover:text-gray-500">Tournaments</Link>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <svg className="flex-shrink-0 h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <Link to={`/admin/tournament/${tournament.slug}`} className="ml-4 text-gray-400 hover:text-gray-500">
                        {tournament.name}
                      </Link>
                    </div>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <svg className="flex-shrink-0 h-5 w-5 text-gray-300" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="ml-4 text-sm font-medium text-gray-500">Teams</span>
                    </div>
                  </li>
                </ol>
              </nav>
              <div className="mt-2">
                <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
                <p className="text-gray-600">{teams.length} teams registered</p>
              </div>
            </div>
            
            <button
              onClick={() => setShowAddTeam(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Team
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Institution
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Speakers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teams.map((team) => (
                  <tr key={team.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{team.short_name}</div>
                        <div className="text-sm text-gray-500">{team.long_name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {team.institution?.name || 'No institution'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {team.speakers.map((speaker, index) => (
                          <div key={speaker.id} className="text-sm text-gray-900">
                            {index + 1}. {speaker.name}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        team.team_type === 'normal' ? 'bg-green-100 text-green-800' :
                        team.team_type === 'swing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {team.team_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-900">
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {teams.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No teams</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding your first team.</p>
              <div className="mt-6">
                <button
                  onClick={() => setShowAddTeam(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Add Team
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Team Modal */}
      {showAddTeam && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Team</h3>
              <form onSubmit={handleSubmitTeam} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Short Name *</label>
                    <input
                      type="text"
                      required
                      value={teamForm.short_name}
                      onChange={(e) => setTeamForm(prev => ({ ...prev, short_name: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., Oxford A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Long Name</label>
                    <input
                      type="text"
                      value={teamForm.long_name}
                      onChange={(e) => setTeamForm(prev => ({ ...prev, long_name: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., University of Oxford A"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Institution</label>
                    <select
                      value={teamForm.institution_id}
                      onChange={(e) => setTeamForm(prev => ({ ...prev, institution_id: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select institution (optional)</option>
                      {institutions.map((institution) => (
                        <option key={institution.id} value={institution.id}>
                          {institution.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Team Type</label>
                    <select
                      value={teamForm.team_type}
                      onChange={(e) => setTeamForm(prev => ({ ...prev, team_type: e.target.value as any }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="normal">Normal Team</option>
                      <option value="swing">Swing Team</option>
                      <option value="bye">Bye Team</option>
                      <option value="composite">Composite Team</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={teamForm.use_institution_prefix}
                      onChange={(e) => setTeamForm(prev => ({ ...prev, use_institution_prefix: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">Use institution prefix in team name</span>
                  </label>
                </div>

                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Speakers</h4>
                  <div className="space-y-4">
                    {teamForm.speakers.map((speaker, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-3">Speaker {index + 1}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Name *</label>
                            <input
                              type="text"
                              required
                              value={speaker.name}
                              onChange={(e) => updateSpeaker(index, 'name', e.target.value)}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="Speaker name"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input
                              type="email"
                              value={speaker.email}
                              onChange={(e) => updateSpeaker(index, 'email', e.target.value)}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="speaker@email.com"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                            <input
                              type="tel"
                              value={speaker.phone}
                              onChange={(e) => updateSpeaker(index, 'phone', e.target.value)}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="+1234567890"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddTeam(false)}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Add Team
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

export default TeamsAdmin

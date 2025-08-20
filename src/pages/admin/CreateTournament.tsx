import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../config/supabase'

const CreateTournament: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<{
    name: string
    short_name: string
    slug: string
    description: string
    format: 'BP' | 'AP' | '2vs2'
    preferences: {
      teams_in_debate: number
      speakers_in_team: number
      min_speaker_score: number
      max_speaker_score: number
      public_results: boolean
      public_draw: boolean
      public_standings: boolean
      enable_checkins: boolean
    }
  }>({
    name: '',
    short_name: '',
    slug: '',
    description: '',
    format: 'BP',
    preferences: {
      teams_in_debate: 4,
      speakers_in_team: 2,
      min_speaker_score: 68.0,
      max_speaker_score: 82.0,
      public_results: false,
      public_draw: false,
      public_standings: false,
      enable_checkins: true
    }
  })

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: prev.slug === generateSlug(prev.name) ? generateSlug(name) : prev.slug
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Check if slug is unique
      const { data: existingTournament } = await supabase
        .from('tournaments')
        .select('id')
        .eq('slug', formData.slug)
        .single()

      if (existingTournament) {
        throw new Error('A tournament with this slug already exists')
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be logged in to create a tournament')

      // Create tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          name: formData.name,
          short_name: formData.short_name || null,
          slug: formData.slug,
          description: formData.description || null,
          format: formData.format,
          created_by: user.id,
          active: true,
          preferences: {
            teams_in_debate: formData.preferences.teams_in_debate,
            speakers_in_team: formData.preferences.speakers_in_team,
            substantive_speakers: formData.preferences.speakers_in_team,
            reply_scores_enabled: formData.format === 'BP',
            min_speaker_score: formData.preferences.min_speaker_score,
            max_speaker_score: formData.preferences.max_speaker_score,
            speaker_score_step: 0.5,
            team_points_win: 1,
            team_points_loss: 0,
            draw_side_allocations: 'balance',
            public_results: formData.preferences.public_results,
            public_draw: formData.preferences.public_draw,
            public_standings: formData.preferences.public_standings,
            enable_checkins: formData.preferences.enable_checkins,
            enable_motions: true,
            enable_venue_constraints: false
          }
        })
        .select()
        .single()

      if (tournamentError) throw tournamentError

      // Create default break category
      await supabase
        .from('break_categories')
        .insert({
          tournament_id: tournament.id,
          name: 'Open',
          slug: 'open',
          is_general: true,
          break_size: 16,
          seq: 1
        })

      // Create default speaker category if needed
      if (formData.format === 'BP') {
        await supabase
          .from('speaker_categories')
          .insert({
            tournament_id: tournament.id,
            name: 'ESL',
            slug: 'esl',
            seq: 1
          })
      }

      // Navigate to tournament admin
      navigate(`/admin/tournament/${tournament.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Create New Tournament</h1>
          <p className="text-gray-600 mt-2">Set up a new debate tournament with your preferred configuration.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Tournament Name *
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Asian Universities Debating Championship 2025"
              />
            </div>

            <div>
              <label htmlFor="short_name" className="block text-sm font-medium text-gray-700">
                Short Name
              </label>
              <input
                type="text"
                id="short_name"
                value={formData.short_name}
                onChange={(e) => setFormData(prev => ({ ...prev, short_name: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., AUDC 2025"
              />
            </div>

            <div>
              <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
                URL Slug *
              </label>
              <input
                type="text"
                id="slug"
                required
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., audc2025"
                pattern="^[a-z0-9-]+$"
                title="Only lowercase letters, numbers, and hyphens allowed"
              />
              <p className="mt-1 text-sm text-gray-500">
                This will be used in the URL: /tournament/{formData.slug}
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief description of the tournament..."
              />
            </div>

            <div>
              <label htmlFor="format" className="block text-sm font-medium text-gray-700">
                Debate Format *
              </label>
              <select
                id="format"
                required
                value={formData.format}
                onChange={(e) => {
                  const format = e.target.value as 'BP' | 'AP' | '2vs2'
                  setFormData(prev => ({
                    ...prev,
                    format,
                    preferences: {
                      ...prev.preferences,
                      teams_in_debate: format === 'BP' ? 4 : 2,
                      speakers_in_team: format === 'BP' ? 2 : format === 'AP' ? 2 : 2
                    }
                  }))
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="BP">British Parliamentary (4 teams)</option>
                <option value="AP">Asian Parliamentary (2 teams)</option>
                <option value="2vs2">American Parliamentary (2 teams)</option>
              </select>
            </div>
          </div>

          {/* Tournament Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Tournament Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="teams_in_debate" className="block text-sm font-medium text-gray-700">
                  Teams per Debate
                </label>
                <input
                  type="number"
                  id="teams_in_debate"
                  min="2"
                  max="4"
                  value={formData.preferences.teams_in_debate}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, teams_in_debate: parseInt(e.target.value) }
                  }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="speakers_in_team" className="block text-sm font-medium text-gray-700">
                  Speakers per Team
                </label>
                <input
                  type="number"
                  id="speakers_in_team"
                  min="1"
                  max="3"
                  value={formData.preferences.speakers_in_team}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, speakers_in_team: parseInt(e.target.value) }
                  }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="min_speaker_score" className="block text-sm font-medium text-gray-700">
                  Min Speaker Score
                </label>
                <input
                  type="number"
                  id="min_speaker_score"
                  step="0.5"
                  min="50"
                  max="90"
                  value={formData.preferences.min_speaker_score}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, min_speaker_score: parseFloat(e.target.value) }
                  }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="max_speaker_score" className="block text-sm font-medium text-gray-700">
                  Max Speaker Score
                </label>
                <input
                  type="number"
                  id="max_speaker_score"
                  step="0.5"
                  min="70"
                  max="100"
                  value={formData.preferences.max_speaker_score}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, max_speaker_score: parseFloat(e.target.value) }
                  }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Privacy & Access</h3>
            
            <div className="space-y-3">
              {[
                { key: 'public_results', label: 'Public Results', desc: 'Allow public viewing of results' },
                { key: 'public_draw', label: 'Public Draw', desc: 'Allow public viewing of draw/pairings' },
                { key: 'public_standings', label: 'Public Standings', desc: 'Allow public viewing of standings' },
                { key: 'enable_checkins', label: 'Enable Check-ins', desc: 'Use QR code check-in system' }
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id={key}
                      type="checkbox"
                      checked={formData.preferences[key as keyof typeof formData.preferences] as boolean}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, [key]: e.target.checked }
                      }))}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor={key} className="font-medium text-gray-700">{label}</label>
                    <p className="text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Tournament'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateTournament

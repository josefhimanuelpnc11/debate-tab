
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../config/supabase'
import type { Tournament, Team, Member, Speaker, Round } from '../types/db'

type User = {
  id: string
  full_name?: string | null
  email?: string | null
}

export default function TournamentPage() {
  const { id } = useParams()
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [users, setUsers] = useState<Record<string, User>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        // Speakers
        const { data: speakerData, error: speakerErr } = await supabase
          .from('speakers')
          .select('*')
          .in('team_id', (teamData || []).map(t => t.id))
        if (speakerErr) throw speakerErr
        setSpeakers(speakerData || [])

        // Rounds (for motions)
        const { data: roundData, error: roundErr } = await supabase
          .from('rounds')
          .select('*')
          .eq('tournament_id', id)
        if (roundErr) throw roundErr
        setRounds(roundData || [])

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

  if (loading) return <main className="mx-auto max-w-6xl px-4"><p className="py-10 text-zinc-400">Loading…</p></main>
  if (error) return <main className="mx-auto max-w-6xl px-4"><p className="py-10 text-rose-400">Error: {error}</p></main>
  if (!tournament) return <main className="mx-auto max-w-6xl px-4"><p className="py-10">Not found.</p></main>

  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="py-8">
        <h1 className="text-3xl font-bold text-white">{tournament.name}</h1>
        {tournament.description && (
          <p className="mt-2 max-w-3xl text-zinc-300">{tournament.description}</p>
        )}
      </section>

      <section className="pb-10 grid gap-8 lg:grid-cols-2">
        {/* Teams */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-lg font-semibold mb-2">Teams</h2>
          {teams.length === 0 ? (
            <p className="text-sm text-zinc-400">No teams yet.</p>
          ) : (
            <ul className="space-y-1">
              {teams.map(team => (
                <li key={team.id} className="text-white">
                  {team.name} <span className="text-zinc-400">{team.institution ? `(${team.institution})` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Motions (Rounds) */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-lg font-semibold mb-2">Motions</h2>
          {rounds.length === 0 ? (
            <p className="text-sm text-zinc-400">No motions yet.</p>
          ) : (
            <ul className="space-y-1">
              {rounds.map(round => (
                <li key={round.id} className="text-white">
                  <span className="font-bold">Round {round.round_number}:</span> {round.motion || <span className="text-zinc-400">(No motion set)</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Speakers */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-lg font-semibold mb-2">Speakers</h2>
          {speakers.length === 0 ? (
            <p className="text-sm text-zinc-400">No speakers yet.</p>
          ) : (
            <ul className="space-y-1">
              {speakers.map(speaker => (
                <li key={speaker.id} className="text-white">
                  {speaker.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Participants (Members) */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
          <h2 className="text-lg font-semibold mb-2">Participants</h2>
          {members.length === 0 ? (
            <p className="text-sm text-zinc-400">No participants yet.</p>
          ) : (
            <ul className="space-y-1">
              {members.map(member => {
                const user = users[member.user_id]
                const name = user?.full_name || user?.email || member.user_id
                return (
                  <li key={member.id} className="text-white">
                    {name} <span className="text-zinc-400">({member.role})</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </main>
  )
}

import { Link } from 'react-router-dom'

export default function AdminHome() {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {[
        { t: 'Tournaments', d: '/admin/tournaments' },
  { t: 'Users', d: '/admin/users' },
        { t: 'Teams', d: '/admin/teams' },
        { t: 'Rounds', d: '/admin/rounds' },
        { t: 'Speakers', d: '/admin/speakers' },
        { t: 'Members', d: '/admin/members' },
  { t: 'Match Teams', d: '/admin/match-teams' },
  { t: 'Results', d: '/admin/results' },
      ].map(x => (
        <Link key={x.t} to={x.d} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-white hover:border-indigo-500 hover:bg-zinc-900">
          <div className="text-lg font-semibold">{x.t}</div>
          <div className="text-sm text-zinc-400">Manage {x.t.toLowerCase()}</div>
        </Link>
      ))}
    </section>
  )
}

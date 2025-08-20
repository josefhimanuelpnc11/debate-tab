import { Link, Outlet } from 'react-router-dom'

export default function AdminLayout() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <nav className="flex gap-2 text-sm">
          <Link className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200" to="/admin">Home</Link>
          <Link className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200" to="/admin/tournaments">Tournaments</Link>
          <Link className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200" to="/admin/users">Users</Link>
          <Link className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200" to="/admin/teams">Teams</Link>
          <Link className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200" to="/admin/rounds">Rounds</Link>
          <Link className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200" to="/admin/speakers">Speakers</Link>
          <Link className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-zinc-200" to="/admin/match-teams">Match Teams</Link>
        </nav>
      </div>
      <Outlet />
    </main>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../config/supabase'
import type { Tournament } from '../types/db'
import SupabaseStatus from '../components/SupabaseStatus'

export default function HomePage() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [stats, setStats] = useState<{ tournaments: number; teams: number; rounds: number } | null>(null)
  const [latestRounds, setLatestRounds] = useState<Array<{ id: string; round_number: number; tournament_id: string; created_at?: string | null; motion?: string | null }> | null>(null)

  useEffect(() => {
    let cancelled = false
    const channel = supabase
      .channel('tournaments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, () => {
        // Refetch tournaments list on any change
        fetchTournaments()
      })
      .subscribe()

    async function fetchTournaments() {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, description, created_at')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        setError(error.message)
        setTournaments(null)
      } else {
        setTournaments(data as Tournament[])
      }
    }

    async function fetchStats() {
      const [tCount, teamCount, rCount] = await Promise.all([
        supabase.from('tournaments').select('id', { count: 'exact', head: true }),
        supabase.from('teams').select('id', { count: 'exact', head: true }),
        supabase.from('rounds').select('id', { count: 'exact', head: true }),
      ])
      if (cancelled) return
      const tournaments = tCount.count ?? 0
      const teams = teamCount.count ?? 0
      const rounds = rCount.count ?? 0
      setStats({ tournaments, teams, rounds })
    }

    async function fetchLatestRounds() {
      const { data, error } = await supabase
        .from('rounds')
        .select('id, round_number, motion, tournament_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5)
      if (cancelled) return
      if (error) {
        // don't fail page; just ignore rounds on error
        console.warn('latest rounds error', error)
        setLatestRounds([])
      } else {
        setLatestRounds(data as any)
      }
    }

    async function load() {
      setLoading(true)
      await Promise.all([fetchTournaments(), fetchStats(), fetchLatestRounds()])
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!tournaments) return []
    if (!q) return tournaments
    const s = q.toLowerCase()
    return tournaments.filter(t =>
      t.name.toLowerCase().includes(s) || (t.description ?? '').toLowerCase().includes(s)
    )
  }, [tournaments, q])

  const featured = filtered[0]
  const rest = filtered.slice(1)
  const isNew = (iso?: string) => iso ? (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24) < 7 : false
  const timeAgo = (iso?: string | null) => {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const s = Math.floor(diff / 1000)
    if (s < 60) return `${s}s ago`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  }

  return (
    <main className="mx-auto max-w-6xl px-4">
      {/* Gradient Hero */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-indigo-600/20 via-indigo-600/10 to-transparent px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">DebateTab</h1>
            <p className="mt-2 max-w-2xl text-zinc-200">
              Public portal for multi-tournament debate info — teams, rounds, motions, results, and standings.
            </p>
            <div className="mt-3 text-xs text-zinc-400">
              <SupabaseStatus />
            </div>
          </div>
          <div className="w-full max-w-md">
            <label className="sr-only" htmlFor="search">Search</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-zinc-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 1 0 3.993 12.17l3.794 3.793a.75.75 0 1 0 1.06-1.06l-3.793-3.794A6.75 6.75 0 0 0 10.5 3.75Zm-5.25 6.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Z" clipRule="evenodd" /></svg>
              </span>
              <input
                id="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search tournaments…"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500"
              />
            </div>
            <p className="mt-2 text-xs text-zinc-400">{stats ? `${stats.tournaments} tournaments` : '—'}</p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: 'Tournaments', value: stats?.tournaments ?? '—' },
          { label: 'Teams', value: stats?.teams ?? '—' },
          { label: 'Rounds', value: stats?.rounds ?? '—' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs uppercase tracking-wide text-zinc-400">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Featured */}
      {!loading && !error && featured && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Featured</h2>
          <Link to={`/tournament/${featured.id}`} className="group block rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-indigo-500 hover:bg-zinc-900">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold text-white group-hover:text-indigo-300">{featured.name}</h3>
                  {isNew((featured as any).created_at) && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">New</span>
                  )}
                </div>
                {featured.description && (
                  <p className="mt-1 max-w-3xl text-zinc-300">{featured.description}</p>
                )}
              </div>
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">Teams</span>
                <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">Rounds</span>
                <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">Results</span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* All tournaments */}
      <section className="mt-8 pb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">All Tournaments</h2>
        </div>
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900" />
            ))}
          </div>
        )}
        {error && <p className="text-rose-400">Error: {error}</p>}
        {!loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((t) => (
              <Link
                key={t.id}
                to={`/tournament/${t.id}`}
                className="group rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-indigo-500 hover:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-white group-hover:text-indigo-300">
                    {t.name}
                  </h3>
                  {isNew((t as any).created_at) && (
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">New</span>
                  )}
                </div>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-300">{t.description}</p>
                )}
                {(t as any).created_at && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Created {new Date((t as any).created_at).toLocaleDateString()}
                  </p>
                )}
              </Link>
            ))}
            {!loading && rest.length === 0 && !featured && (
              <p className="text-zinc-400">No tournaments found.</p>
            )}
          </div>
        )}
      </section>

      {/* Latest activity */}
      <section className="mt-2 pb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Latest Rounds</h2>
        {!latestRounds && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900" />
            ))}
          </div>
        )}
        {latestRounds && latestRounds.length === 0 && (
          <p className="text-zinc-400">No recent rounds.</p>
        )}
        {latestRounds && latestRounds.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {latestRounds.map((r) => {
              const t = tournaments?.find((x) => x.id === r.tournament_id)
              return (
                <Link
                  key={r.id}
                  to={t ? `/tournament/${t.id}` : '#'}
                  className="group rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-indigo-500 hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white group-hover:text-indigo-300">{t?.name ?? 'Unknown Tournament'}</div>
                      <div className="mt-0.5 text-xs text-zinc-400">Round {r.round_number} {r.motion ? `• ${r.motion}` : ''}</div>
                    </div>
                    <div className="shrink-0 text-xs text-zinc-400">{timeAgo(r.created_at)}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

  {/* Resources footer-like */}
      <section className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Resources</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <a href="https://supabase.com/" target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-zinc-200 hover:border-indigo-500">
            <div className="font-medium">Supabase</div>
            <div className="text-sm text-zinc-400">Database, Auth & Realtime</div>
          </a>
          <a href="https://tabbycat-debate.org/" target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-zinc-200 hover:border-indigo-500">
            <div className="font-medium">Tabbycat</div>
            <div className="text-sm text-zinc-400">Inspiration for debate portals</div>
          </a>
          <a href="https://github.com/josefhimanuelpnc11/debate-tab" target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-zinc-200 hover:border-indigo-500">
            <div className="font-medium">Source Code</div>
            <div className="text-sm text-zinc-400">Contribute or self-host</div>
          </a>
        </div>
      </section>
    </main>
  )
}

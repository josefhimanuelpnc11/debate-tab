import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../components/AuthProvider'

export default function SimpleAdminGuard() {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Checking access…</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  if (isAdmin === false) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-amber-200">You're signed in as {user.email ?? '—'}, but don't have admin access.</p>
          <p className="mt-1 text-xs text-amber-300">Ask an admin to grant access, or sign in with a different account.</p>
          <a href={`${import.meta.env.BASE_URL}auth`} className="mt-3 inline-block rounded-md border border-amber-500/30 bg-amber-500/20 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/30">Go to Login</a>
        </div>
      </main>
    )
  }

  if (isAdmin === null) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Verifying admin access…</p>
        </div>
      </main>
    )
  }

  return <Outlet />
}

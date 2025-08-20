import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { supabase } from '../../config/supabase'

type GuardState = 'checking' | 'no-session' | 'ok' | 'not-admin' | 'error'

export default function AdminGuard() {
  const [state, setState] = useState<GuardState>('checking')
  const [message, setMessage] = useState<string | null>(null)
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const runIdRef = useRef(0)
  const inFlightRef = useRef(false)
  const errorTimerRef = useRef<number | null>(null)

  async function rpcIsAdmin(): Promise<boolean> {
    const { data, error } = await supabase.rpc('current_is_admin')
    if (error) throw error
    return !!data
  }

  async function fallbackIsAdmin(uid: string, email: string | null): Promise<boolean | 'not-found'> {
    const byUid = await supabase.from('users').select('is_admin').eq('auth_uid', uid).maybeSingle()
    if (byUid.data) return !!byUid.data.is_admin
    if (byUid.error && byUid.error.code && byUid.error.code !== 'PGRST116') throw byUid.error
    if (email) {
      const byEmail = await supabase.from('users').select('is_admin').eq('email', email).maybeSingle()
      if (byEmail.data) return !!byEmail.data.is_admin
      if (byEmail.error && byEmail.error.code && byEmail.error.code !== 'PGRST116') throw byEmail.error
    }
    return 'not-found'
  }

  const withTimeout = async <T,>(p: Promise<T>, ms = 12000): Promise<T> => {
    return await Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Request timeout')), ms)),
    ])
  }

  const check = async (sessionArg?: { user?: { id?: string; email?: string | null } } | null) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    const myRun = ++runIdRef.current
    // Watchdog to ensure we never hang permanently
    const watchdog = window.setTimeout(() => {
      if (runIdRef.current === myRun && state === 'checking') {
        setMessage((prev) => prev ?? 'Request timeout')
        setState('error')
        inFlightRef.current = false
      }
    }, 15000)
    try {
      if (state !== 'ok') setState('checking')
      setMessage(null)
      // Use provided session if available to avoid an extra round-trip
      let sess: any = sessionArg ?? null
      if (!sess) {
        const { data, error } = await withTimeout(supabase.auth.getSession())
        if (runIdRef.current !== myRun) return
        if (error) throw error
        sess = data.session
      }
      const uid = sess?.user?.id
      const email = sess?.user?.email ?? null
      setSessionEmail(email)
      if (!uid) { setState('no-session'); return }

      // Prefer RPC if available
      try {
        const isAdmin = await withTimeout(rpcIsAdmin())
        if (runIdRef.current !== myRun) return
        if (errorTimerRef.current) { window.clearTimeout(errorTimerRef.current); errorTimerRef.current = null }
        setState(isAdmin ? 'ok' : 'not-admin')
        return
      } catch {
        // Fallback to direct select
      }

      // Try twice to tolerate transient issues
      let attempts = 0
      while (attempts < 2) {
        try {
          const res = await withTimeout(fallbackIsAdmin(uid, email))
          if (runIdRef.current !== myRun) return
          if (errorTimerRef.current) { window.clearTimeout(errorTimerRef.current); errorTimerRef.current = null }
          if (res === true) { setState('ok'); return }
          if (res === false) { setState('not-admin'); return }
          setState('not-admin'); return
        } catch (e) {
          attempts++
          if (attempts >= 2) throw e
        }
      }
    } catch (e: any) {
      if (runIdRef.current !== myRun) return
      const msg = e?.message ?? 'Could not verify admin access'
      setMessage(msg)
      // Debounce transient error display; cancel if a next check fixes quickly
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current)
      errorTimerRef.current = window.setTimeout(() => {
        if (runIdRef.current === myRun) setState('error')
      }, 500) as unknown as number
    } finally {
      window.clearTimeout(watchdog)
      inFlightRef.current = false
    }
  }

  useEffect(() => {
    check()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (errorTimerRef.current) { window.clearTimeout(errorTimerRef.current); errorTimerRef.current = null }
      if (!inFlightRef.current) check(session ?? null)
    })
    return () => { sub.subscription.unsubscribe() }
  }, [])

  if (state === 'checking') return <main className="mx-auto max-w-6xl px-4 py-10"><p className="text-zinc-400">Checking access…</p></main>
  if (state === 'no-session') return <Navigate to="/auth" replace />
  if (state === 'error') return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
        <p className="text-rose-300">Auth check failed{message ? `: ${message}` : ''}</p>
        <div className="mt-2 text-xs text-rose-200">Email: {sessionEmail ?? '—'}</div>
        <button onClick={() => check()} className="mt-3 rounded-md border border-rose-500/30 bg-rose-500/20 px-3 py-1.5 text-sm text-rose-100 hover:bg-rose-500/30">Retry</button>
      </div>
    </main>
  )
  if (state === 'not-admin') return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <p className="text-amber-200">You’re signed in as {sessionEmail ?? '—'}, but don’t have admin access.</p>
        <p className="mt-1 text-xs text-amber-300">Ask an admin to grant access, or sign in with a different account.</p>
        <a href={`${import.meta.env.BASE_URL}auth`} className="mt-3 inline-block rounded-md border border-amber-500/30 bg-amber-500/20 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-500/30">Go to Login</a>
      </div>
    </main>
  )
  return <Outlet />
}

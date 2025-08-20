import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../config/supabase'

export default function Navbar() {
  const [email, setEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const runRef = useRef(0)
  useEffect(() => {
    let mounted = true
    async function refresh(session?: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) {
      if (!mounted) return
      const thisRun = ++runRef.current
      let sess = session
      if (!sess) {
        const { data } = await supabase.auth.getSession()
        sess = data.session ?? undefined
      }
      const em = sess?.user?.email ?? null
      const uid = sess?.user?.id
      setEmail(em)
      if (!uid) { if (mounted && runRef.current === thisRun) setIsAdmin(false); return }
      try {
        const res = await supabase.from('users').select('is_admin').eq('auth_uid', uid).maybeSingle()
        if (mounted && runRef.current === thisRun) setIsAdmin(!!res.data?.is_admin)
      } catch {
        if (mounted && runRef.current === thisRun) setIsAdmin(false)
      }
    }
    refresh()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { refresh(session ?? undefined) })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold text-white">DebateTab</Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-300">
          <Link to="/" className="hover:text-white">Home</Link>
      {email ? (
            <>
        {isAdmin && <Link to="/admin" className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20">Admin</Link>}
              <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{email}</span>
            </>
          ) : null}
          <Link to="/auth" className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-500">{email ? 'Account' : 'Login'}</Link>
        </nav>
      </div>
    </header>
  )
}

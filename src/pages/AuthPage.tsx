import { useEffect, useState } from 'react'
import { supabase } from '../config/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setLoggedInEmail(data.session?.user?.email ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedInEmail(session?.user?.email ?? null)
    })
    return () => { sub.subscription.unsubscribe(); active = false }
  }, [])

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (!email) { setError('Email is required'); return }
    setLoading(true)
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}auth`
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })
    setLoading(false)
    if (error) setError(error.message)
    else setInfo('Magic link sent! Check your inbox and return here after login.')
  }

  async function signInWithGitHub() {
    setError(null)
    setInfo(null)
    setOauthLoading(true)
  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}auth`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo,
        // scopes: 'read:user user:email', // optional, defaults are fine
      },
    })
    if (error) {
      setOauthLoading(false)
      setError(error.message)
    }
    // On success, browser will be redirected to GitHub → Supabase → redirectTo
  }

  async function signOut() {
    await supabase.auth.signOut()
    setInfo('Signed out')
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold text-white">Admin Login</h1>
      <p className="mt-2 text-sm text-zinc-400">Use your email to receive a magic link. Ensure your provider/domain is configured in Supabase Auth.</p>

      {loggedInEmail ? (
        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-sm text-zinc-200">Signed in as <span className="font-medium">{loggedInEmail}</span></p>
          <button onClick={signOut} className="mt-3 rounded-md bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700">Sign out</button>
        </div>
      ) : (
        <>
          <form onSubmit={sendMagicLink} className="mt-6 space-y-3">
            <label className="block text-sm text-zinc-300" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-indigo-500"
            />
            <button disabled={loading} type="submit" className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60">
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs uppercase text-zinc-500">or</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <button
            onClick={signInWithGitHub}
            disabled={oauthLoading}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {oauthLoading ? 'Redirecting…' : 'Continue with GitHub'}
          </button>
        </>
      )}

      {error && <p className="mt-4 text-sm text-rose-400">Error: {error}</p>}
      {info && <p className="mt-4 text-sm text-emerald-400">{info}</p>}
    </main>
  )
}

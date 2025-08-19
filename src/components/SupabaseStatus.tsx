import { useEffect, useState } from 'react'
import { supabase } from '../config/supabase'

export default function SupabaseStatus() {
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    async function ping() {
      try {
        // Lightweight check: HEAD select on expected public table (create via schema.sql)
        const { error } = await supabase
          .from('tournaments')
          .select('id', { count: 'exact', head: true })
        if (!cancelled) {
          if (error) {
            setStatus('error')
            setMessage(error.message)
          } else {
            setStatus('ok')
            setMessage('Connected')
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setStatus('error')
          setMessage(e?.message ?? 'Unknown error')
        }
      }
    }
    ping()
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'idle') return <p>Checking Supabase…</p>
  if (status === 'error') return <p style={{ color: 'crimson' }}>Supabase error: {message}</p>
  return <p style={{ color: 'green' }}>Supabase: {message}</p>
}

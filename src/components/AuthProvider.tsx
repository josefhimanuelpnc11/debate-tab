import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../config/supabase'
import type { User, Session } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: null
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

type AuthProviderProps = {
  children: ReactNode
}

// Cache admin status to prevent repeated checks
let adminStatusCache: { userId: string; isAdmin: boolean; timestamp: number } | null = null
const ADMIN_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  const checkAdminStatus = async (userId: string) => {
    // Check cache first
    if (adminStatusCache && 
        adminStatusCache.userId === userId && 
        Date.now() - adminStatusCache.timestamp < ADMIN_CACHE_DURATION) {
      setIsAdmin(adminStatusCache.isAdmin)
      return
    }

    try {
      // Try RPC first
      const { data, error } = await supabase.rpc('current_is_admin')
      if (!error && data !== null) {
        const adminStatus = !!data
        adminStatusCache = { userId, isAdmin: adminStatus, timestamp: Date.now() }
        setIsAdmin(adminStatus)
        return
      }

      // Fallback to direct query
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('auth_uid', userId)
        .maybeSingle()

      if (userError) {
        console.error('Error checking admin status:', userError)
        setIsAdmin(false)
        return
      }

      const adminStatus = !!userData?.is_admin
      adminStatusCache = { userId, isAdmin: adminStatus, timestamp: Date.now() }
      setIsAdmin(adminStatus)
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      
      if (initialSession?.user) {
        checkAdminStatus(initialSession.user.id)
      } else {
        setIsAdmin(null)
        adminStatusCache = null
      }
      
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession)
        setUser(newSession?.user ?? null)
        
        if (newSession?.user) {
          await checkAdminStatus(newSession.user.id)
        } else {
          setIsAdmin(null)
          adminStatusCache = null
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

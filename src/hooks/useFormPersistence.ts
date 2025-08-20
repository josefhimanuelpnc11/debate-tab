import { useEffect, useState } from 'react'

/**
 * Hook for persisting form data to localStorage
 * Automatically saves and restores form state
 */
export function useFormPersistence<T>(
  key: string, 
  initialState: T,
  enabled: boolean = true
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState<T>(initialState)

  // Restore from localStorage on mount
  useEffect(() => {
    if (!enabled || !key) return
    
    try {
      const saved = localStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved)
        setState(parsed)
      }
    } catch (error) {
      console.warn('Failed to restore form data:', error)
    }
  }, [key, enabled])

  // Save to localStorage when state changes
  useEffect(() => {
    if (!enabled || !key) return
    
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch (error) {
      console.warn('Failed to save form data:', error)
    }
  }, [key, state, enabled])

  // Clear function
  const clearPersistedData = () => {
    if (!enabled || !key) return
    
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('Failed to clear form data:', error)
    }
  }

  return [state, setState, clearPersistedData]
}

/**
 * Hook for preventing accidental navigation when form has unsaved data
 */
export function useFormProtection(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasUnsavedChanges) {
        // Save a flag indicating there are unsaved changes
        sessionStorage.setItem('hasUnsavedChanges', 'true')
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [hasUnsavedChanges])

  // Check for unsaved changes warning on mount
  useEffect(() => {
    const hasUnsaved = sessionStorage.getItem('hasUnsavedChanges')
    if (hasUnsaved) {
      sessionStorage.removeItem('hasUnsavedChanges')
      // Could show a toast notification here
      console.info('Previous session had unsaved changes - data may have been restored from localStorage')
    }
  }, [])
}

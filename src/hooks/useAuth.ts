import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { appUrl } from '../lib/appUrl'

// El link del email de recuperación vuelve a la app con `type=recovery` en el
// hash. Se lee al cargar el módulo porque supabase-js puede emitir el evento
// PASSWORD_RECOVERY antes de que un componente llegue a suscribirse.
const openedFromRecoveryLink =
  typeof window !== 'undefined' && window.location.hash.includes('type=recovery')

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(openedFromRecoveryLink)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email: string, password: string) =>
    supabase.auth.signUp({ email, password })

  const signOut = () => supabase.auth.signOut()

  const sendPasswordReset = (email: string) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl('/') })

  const updatePassword = (password: string) => supabase.auth.updateUser({ password })

  return {
    session,
    loading,
    recovering,
    finishRecovery: () => setRecovering(false),
    signIn,
    signUp,
    signOut,
    sendPasswordReset,
    updatePassword,
  }
}

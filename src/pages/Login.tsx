import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { PasswordInput } from '../components/PasswordInput'
import { asset } from '../lib/appUrl'

type Mode = 'signin' | 'signup' | 'reset'

const MIN_PASSWORD = 6

export function Login() {
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setMessage(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (mode === 'reset') {
      const { error } = await sendPasswordReset(email)
      if (error) setError(error.message)
      else setMessage('Si existe una cuenta con ese email, te enviamos un link para crear una contraseña nueva.')
      setLoading(false)
      return
    }

    const { error } =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password)

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos.'
          : error.message
      )
    } else if (mode === 'signup') {
      setMessage('Cuenta creada. Revisa tu email para confirmarla.')
    }
    setLoading(false)
  }

  const title =
    mode === 'signin' ? 'Inicia sesión' : mode === 'signup' ? 'Crea tu cuenta' : 'Recuperar contraseña'
  const submitLabel =
    mode === 'signin' ? 'Iniciar sesión' : mode === 'signup' ? 'Crear cuenta' : 'Enviar link'

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <img
        src={asset('icons/icon-192.png')}
        alt=""
        className="mb-4 h-16 w-16 rounded-2xl shadow-lg shadow-black/40"
      />
      <h1 className="text-3xl font-bold text-accent">Shelf Life</h1>
      <p className="mb-8 mt-1 text-sm text-lavender">{title}</p>

      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          enterKeyHint={mode === 'reset' ? 'send' : 'next'}
          placeholder="Email"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl bg-background-surface px-3 py-3 text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {mode !== 'reset' && (
          <PasswordInput
            required
            minLength={mode === 'signup' ? MIN_PASSWORD : undefined}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            enterKeyHint="go"
            placeholder={mode === 'signup' ? `Contraseña (mínimo ${MIN_PASSWORD} caracteres)` : 'Contraseña'}
            aria-label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        {mode === 'signin' && (
          <button
            type="button"
            onClick={() => switchMode('reset')}
            className="-mt-1 min-h-10 self-end text-sm text-lavender"
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-accent">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 min-h-12 rounded-xl bg-primary font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Cargando...' : submitLabel}
        </button>

        <button
          type="button"
          onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          className="min-h-11 text-sm text-lavender"
        >
          {mode === 'signin' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </div>
  )
}

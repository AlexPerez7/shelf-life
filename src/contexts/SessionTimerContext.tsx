import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Cronómetro de sesión de juego. Se guarda en localStorage (solo la hora de
 * inicio), así que sigue contando aunque se cierre la PWA o se apague la
 * pantalla: al volver, el tiempo transcurrido se calcula de nuevo.
 * Es una comodidad por dispositivo; la sesión en sí se guarda en Supabase al
 * detenerlo.
 */
interface RunningTimer {
  gameId: string
  title: string
  /** epoch ms */
  startedAt: number
}

interface SessionTimerValue {
  timer: RunningTimer | null
  start: (gameId: string, title: string) => void
  /** Detiene y devuelve los minutos transcurridos (mínimo 1). */
  stop: () => { gameId: string; minutes: number; startedAt: number } | null
  cancel: () => void
}

const STORAGE_KEY = 'shelflife_session_timer'
/** Un cronómetro olvidado más de un día no es una sesión real. */
const MAX_DURATION_MS = 24 * 60 * 60 * 1000

function load(): RunningTimer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as RunningTimer
    return t && typeof t.startedAt === 'number' && t.gameId ? t : null
  } catch {
    return null
  }
}

function save(timer: RunningTimer | null) {
  try {
    if (timer) localStorage.setItem(STORAGE_KEY, JSON.stringify(timer))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* sin storage: el cronómetro solo vive mientras la app esté abierta */
  }
}

const SessionTimerContext = createContext<SessionTimerValue | null>(null)

export function SessionTimerProvider({ children }: { children: ReactNode }) {
  const [timer, setTimer] = useState<RunningTimer | null>(load)

  // Sincronizar entre pestañas.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setTimer(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const start = useCallback((gameId: string, title: string) => {
    const t = { gameId, title, startedAt: Date.now() }
    save(t)
    setTimer(t)
  }, [])

  const cancel = useCallback(() => {
    save(null)
    setTimer(null)
  }, [])

  const stop = useCallback(() => {
    const current = load() ?? timer
    if (!current) return null
    save(null)
    setTimer(null)
    const elapsed = Math.min(Date.now() - current.startedAt, MAX_DURATION_MS)
    return {
      gameId: current.gameId,
      startedAt: current.startedAt,
      minutes: Math.max(1, Math.round(elapsed / 60000)),
    }
  }, [timer])

  const value = useMemo(() => ({ timer, start, stop, cancel }), [timer, start, stop, cancel])

  return <SessionTimerContext.Provider value={value}>{children}</SessionTimerContext.Provider>
}

export function useSessionTimer() {
  const ctx = useContext(SessionTimerContext)
  if (!ctx) throw new Error('useSessionTimer debe usarse dentro de <SessionTimerProvider>')
  return ctx
}

/** "1:05:09" o "12:34" a partir de milisegundos. */
export function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Re-render cada segundo mientras `active`, devolviendo el "ahora". */
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

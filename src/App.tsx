import { lazy, Suspense, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { GamesProvider } from './contexts/GamesContext'
import { ListsProvider } from './contexts/ListsContext'
import { MediaProvider } from './contexts/MediaContext'
import { ToastProvider } from './contexts/ToastContext'
import { ConfirmProvider } from './contexts/ConfirmContext'
import { ScrollManager } from './components/ScrollManager'
import { SessionTimerProvider } from './contexts/SessionTimerContext'
import { TimerBanner } from './components/TimerBanner'
import { PendingSyncIndicator } from './components/PendingSyncIndicator'
import { Hub } from './pages/Hub'
import { asset } from './lib/appUrl'
import { gamesPaths } from './trackers/juegos/paths'

// El inicio (elegir tracker) va en el bundle principal; cada tracker y el
// resto de las pantallas se cargan bajo demanda para que el primer arranque
// en mobile (red lenta) descargue lo mínimo. El service worker las precachea
// igual, así que después de la primera visita cargan al instante.
const GamesTracker = lazy(() =>
  import('./trackers/juegos/GamesTracker').then((m) => ({ default: m.GamesTracker }))
)
const ScreenTracker = lazy(() =>
  import('./trackers/pantalla/ScreenTracker').then((m) => ({ default: m.ScreenTracker }))
)
const BooksTracker = lazy(() =>
  import('./trackers/libros/BooksTracker').then((m) => ({ default: m.BooksTracker }))
)
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const UpdatePassword = lazy(() =>
  import('./pages/UpdatePassword').then((m) => ({ default: m.UpdatePassword }))
)
const SharedList = lazy(() => import('./pages/SharedList').then((m) => ({ default: m.SharedList })))
const Lists = lazy(() => import('./pages/Lists').then((m) => ({ default: m.Lists })))
const ListDetail = lazy(() => import('./pages/ListDetail').then((m) => ({ default: m.ListDetail })))
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })))

function SplashScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <img
        src={asset('icons/icon-192.png')}
        alt=""
        className="h-20 w-20 animate-pulse rounded-3xl shadow-lg shadow-black/40"
      />
      <span className="sr-only">Cargando...</span>
    </div>
  )
}

/**
 * Rutas de antes de separar los trackers (la app era solo de juegos): links
 * guardados o una PWA instalada con la versión vieja siguen funcionando.
 */
function LegacyRedirect({ to }: { to: (params: Record<string, string | undefined>) => string }) {
  const params = useParams()
  const { search } = useLocation()
  return <Navigate to={`${to(params)}${search}`} replace />
}

const legacyRoutes: [string, (p: Record<string, string | undefined>) => string][] = [
  ['/home', () => gamesPaths.discover],
  ['/add', () => gamesPaths.add],
  ['/game/:id', (p) => gamesPaths.game(p.id ?? '')],
  ['/lists', () => gamesPaths.lists],
  ['/lists/:id', (p) => gamesPaths.list(p.id ?? '')],
  ['/dashboard', () => gamesPaths.stats],
  ['/timeline', () => gamesPaths.diary],
  ['/steam-import', () => gamesPaths.steamImport],
  ['/steam-import/callback', () => gamesPaths.steamCallback],
]

const ONBOARDING_KEY = 'shelflife_onboarding_seen'

function App() {
  const { session, loading, recovering, finishRecovery } = useAuth()
  const location = useLocation()
  const [onboardingSeen, setOnboardingSeen] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === 'true'
  )

  // GamesProvider/MediaProvider/ListsProvider quedan siempre montados (aunque no haya
  // sesión todavía) para que su listener de onAuthStateChange esté
  // suscripto ANTES de que el login dispare el evento SIGNED_IN. Si en
  // cambio solo se montaran después de que `session` pasa a ser verdadero,
  // se pierden ese evento inicial y la primera consulta puede dispararse
  // en la ventana en que el cliente de Supabase todavía no terminó de
  // adjuntar el token nuevo, trayendo listas vacías hasta refrescar.
  let content
  if (location.pathname.startsWith('/compartir/')) {
    // Lista compartida: pública, no requiere sesión ni onboarding.
    content = (
      <Suspense fallback={<SplashScreen />}>
        <Routes>
          <Route path="/compartir/:id" element={<SharedList />} />
        </Routes>
      </Suspense>
    )
  } else if (loading) {
    content = <SplashScreen />
  } else if (session && recovering) {
    content = (
      <Suspense fallback={<SplashScreen />}>
        <UpdatePassword onDone={finishRecovery} />
      </Suspense>
    )
  } else if (!session) {
    content = (
      <Suspense fallback={<SplashScreen />}>
        {!onboardingSeen ? (
          <Onboarding
            onFinish={() => {
              localStorage.setItem(ONBOARDING_KEY, 'true')
              setOnboardingSeen(true)
            }}
          />
        ) : (
          <Login />
        )}
      </Suspense>
    )
  } else {
    content = (
      <div className="min-h-dvh">
        <ScrollManager />
        {/* Cada tracker tiene sus propias rutas y su barra inferior; el
            inicio (/) es donde se elige a cuál entrar. */}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Hub />} />
            <Route path="/juegos/*" element={<GamesTracker />} />
            <Route path="/pantalla/*" element={<ScreenTracker />} />
            <Route path="/libros/*" element={<BooksTracker />} />
            <Route path="/listas" element={<Lists />} />
            <Route path="/listas/:id" element={<ListDetail />} />
            {legacyRoutes.map(([path, to]) => (
              <Route key={path} path={path} element={<LegacyRedirect to={to} />} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <TimerBanner />
        <PendingSyncIndicator />
      </div>
    )
  }

  return (
    <ToastProvider>
      <ConfirmProvider>
        <GamesProvider>
          <MediaProvider>
            <ListsProvider>
              <SessionTimerProvider>{content}</SessionTimerProvider>
            </ListsProvider>
          </MediaProvider>
        </GamesProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}

export default App

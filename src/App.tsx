import { lazy, Suspense, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { GamesProvider } from './contexts/GamesContext'
import { ListsProvider } from './contexts/ListsContext'
import { MediaProvider } from './contexts/MediaContext'
import { ToastProvider } from './contexts/ToastContext'
import { ConfirmProvider } from './contexts/ConfirmContext'
import { ScrollManager } from './components/ScrollManager'
import { SessionTimerProvider } from './contexts/SessionTimerContext'
import { TimerBanner } from './components/TimerBanner'
import { BottomNav } from './components/BottomNav'
import { Library } from './pages/Library'
import { asset } from './lib/appUrl'

// La biblioteca es la pantalla de entrada y va en el bundle principal; el
// resto se carga bajo demanda para que el primer arranque en mobile (red
// lenta) descargue lo mínimo. El service worker las precachea igual, así que
// después de la primera visita cargan al instante.
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const AddGame = lazy(() => import('./pages/AddGame').then((m) => ({ default: m.AddGame })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const GameDetail = lazy(() => import('./pages/GameDetail').then((m) => ({ default: m.GameDetail })))
const Lists = lazy(() => import('./pages/Lists').then((m) => ({ default: m.Lists })))
const ListDetail = lazy(() => import('./pages/ListDetail').then((m) => ({ default: m.ListDetail })))
const Timeline = lazy(() => import('./pages/Timeline').then((m) => ({ default: m.Timeline })))
const SteamImport = lazy(() => import('./pages/SteamImport').then((m) => ({ default: m.SteamImport })))
const SteamCallback = lazy(() => import('./pages/SteamCallback').then((m) => ({ default: m.SteamCallback })))
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const UpdatePassword = lazy(() =>
  import('./pages/UpdatePassword').then((m) => ({ default: m.UpdatePassword }))
)
const SharedList = lazy(() => import('./pages/SharedList').then((m) => ({ default: m.SharedList })))
const ScreenLibrary = lazy(() =>
  import('./pages/ScreenLibrary').then((m) => ({ default: m.ScreenLibrary }))
)
const AddMedia = lazy(() => import('./pages/AddMedia').then((m) => ({ default: m.AddMedia })))
const MediaDetail = lazy(() => import('./pages/MediaDetail').then((m) => ({ default: m.MediaDetail })))
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
        {/* Suspense solo alrededor de las rutas: mientras baja el chunk de
            una pantalla, la barra de navegación sigue visible. */}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/home" element={<Home />} />
            <Route path="/add" element={<AddGame />} />
            <Route path="/steam-import" element={<SteamImport />} />
            <Route path="/steam-import/callback" element={<SteamCallback />} />
            <Route path="/game/:id" element={<GameDetail />} />
            <Route path="/lists" element={<Lists />} />
            <Route path="/lists/:id" element={<ListDetail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/pantalla" element={<ScreenLibrary />} />
            <Route path="/pantalla/agregar" element={<AddMedia />} />
            <Route path="/pantalla/:id" element={<MediaDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <TimerBanner />
        <BottomNav />
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

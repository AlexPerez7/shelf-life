import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { BarChart3, ClipboardList, Compass, Gamepad2 } from 'lucide-react'
import { TrackerNav } from '../../components/TrackerNav'
import { Library } from './Library'
import { gamesPaths } from './paths'
import { useTrackerTheme } from '../useTrackerTheme'

// La biblioteca va en el bundle del tracker; el resto se carga bajo demanda.
const Home = lazy(() => import('./Home').then((m) => ({ default: m.Home })))
const AddGame = lazy(() => import('./AddGame').then((m) => ({ default: m.AddGame })))
const GameDetail = lazy(() => import('./GameDetail').then((m) => ({ default: m.GameDetail })))
const Lists = lazy(() => import('./Lists').then((m) => ({ default: m.Lists })))
const ListDetail = lazy(() => import('./ListDetail').then((m) => ({ default: m.ListDetail })))
const Dashboard = lazy(() => import('./Dashboard').then((m) => ({ default: m.Dashboard })))
const Timeline = lazy(() => import('./Timeline').then((m) => ({ default: m.Timeline })))
const SteamImport = lazy(() => import('./SteamImport').then((m) => ({ default: m.SteamImport })))
const SteamCallback = lazy(() => import('./SteamCallback').then((m) => ({ default: m.SteamCallback })))

/** Tracker de juegos: todo lo que vive bajo /juegos. */
export function GamesTracker() {
  useTrackerTheme('juegos')

  return (
    <div data-tracker="juegos">
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<Library />} />
          <Route path="descubrir" element={<Home />} />
          <Route path="agregar" element={<AddGame />} />
          <Route path="juego/:id" element={<GameDetail />} />
          <Route path="listas" element={<Lists />} />
          <Route path="listas/:id" element={<ListDetail />} />
          <Route path="estadisticas" element={<Dashboard />} />
          <Route path="diario" element={<Timeline />} />
          <Route path="steam-import" element={<SteamImport />} />
          <Route path="steam-import/callback" element={<SteamCallback />} />
          <Route path="*" element={<Library />} />
        </Routes>
      </Suspense>
      <TrackerNav
        left={[
          { to: gamesPaths.discover, label: 'Descubrir', Icon: Compass },
          {
            to: gamesPaths.library,
            label: 'Biblioteca',
            Icon: Gamepad2,
            isActive: (pathname) =>
              pathname === gamesPaths.library || pathname.startsWith('/juegos/juego/'),
          },
        ]}
        right={[
          { to: gamesPaths.lists, label: 'Listas', Icon: ClipboardList },
          { to: gamesPaths.stats, label: 'Estadísticas', Icon: BarChart3 },
        ]}
        add={{ to: gamesPaths.add, label: 'Agregar juego' }}
      />
    </div>
  )
}

import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { mediaSections } from '../../lib/media'
import { MediaTrackerNav } from '../MediaTrackerNav'
import { useTrackerTheme } from '../useTrackerTheme'
import { ScreenLibrary } from './ScreenLibrary'

const ScreenAdd = lazy(() => import('./ScreenAdd').then((m) => ({ default: m.ScreenAdd })))
const ScreenStats = lazy(() => import('./ScreenStats').then((m) => ({ default: m.ScreenStats })))
const ScreenHistory = lazy(() => import('./ScreenHistory').then((m) => ({ default: m.ScreenHistory })))
const ScreenImport = lazy(() => import('./ScreenImport').then((m) => ({ default: m.ScreenImport })))
const ScreenDetail = lazy(() => import('./ScreenDetail').then((m) => ({ default: m.ScreenDetail })))

const section = mediaSections.pantalla

/**
 * Tracker de Pantalla (películas, series y anime): todo lo que vive bajo
 * /pantalla. Todo con diseño propio, de app de streaming: biblioteca,
 * alta y detalle.
 */
export function ScreenTracker() {
  useTrackerTheme('pantalla')

  return (
    <div data-tracker="pantalla">
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<ScreenLibrary />} />
          <Route path="agregar" element={<ScreenAdd />} />
          <Route path="importar" element={<ScreenImport />} />
          <Route path="estadisticas" element={<ScreenStats />} />
          <Route path="historial" element={<ScreenHistory />} />
          <Route path=":id" element={<ScreenDetail />} />
        </Routes>
      </Suspense>
      <MediaTrackerNav section={section} />
    </div>
  )
}

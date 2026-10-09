import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { mediaSections } from '../../lib/media'
import { MediaTrackerNav } from '../MediaTrackerNav'
import { useTrackerTheme } from '../useTrackerTheme'
import { ScreenLibrary } from './ScreenLibrary'

const AddMedia = lazy(() => import('../../pages/AddMedia').then((m) => ({ default: m.AddMedia })))
const ScreenDetail = lazy(() => import('./ScreenDetail').then((m) => ({ default: m.ScreenDetail })))

const section = mediaSections.pantalla

/**
 * Tracker de Pantalla (películas, series y anime): todo lo que vive bajo
 * /pantalla. La biblioteca y el detalle tienen diseño propio (de app de
 * streaming); el alta todavía es la pantalla genérica.
 */
export function ScreenTracker() {
  useTrackerTheme('pantalla')

  return (
    <div data-tracker="pantalla">
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<ScreenLibrary />} />
          <Route path="agregar" element={<AddMedia sectionId="pantalla" />} />
          <Route path=":id" element={<ScreenDetail />} />
        </Routes>
      </Suspense>
      <MediaTrackerNav section={section} />
    </div>
  )
}

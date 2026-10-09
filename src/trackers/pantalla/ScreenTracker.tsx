import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { mediaSections } from '../../lib/media'
import { MediaTrackerNav } from '../MediaTrackerNav'
import { useTrackerTheme } from '../useTrackerTheme'

const MediaLibrary = lazy(() =>
  import('../../pages/MediaLibrary').then((m) => ({ default: m.MediaLibrary }))
)
const AddMedia = lazy(() => import('../../pages/AddMedia').then((m) => ({ default: m.AddMedia })))
const MediaDetail = lazy(() =>
  import('../../pages/MediaDetail').then((m) => ({ default: m.MediaDetail }))
)

const section = mediaSections.pantalla

/**
 * Tracker de Pantalla (películas, series y anime): todo lo que vive bajo /pantalla.
 */
export function ScreenTracker() {
  useTrackerTheme('pantalla')

  return (
    <div data-tracker="pantalla">
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<MediaLibrary sectionId="pantalla" />} />
          <Route path="agregar" element={<AddMedia sectionId="pantalla" />} />
          <Route path=":id" element={<MediaDetail sectionId="pantalla" />} />
        </Routes>
      </Suspense>
      <MediaTrackerNav section={section} />
    </div>
  )
}

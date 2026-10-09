import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { mediaSections } from '../../lib/media'
import { MediaTrackerNav } from '../MediaTrackerNav'

const MediaLibrary = lazy(() =>
  import('../../pages/MediaLibrary').then((m) => ({ default: m.MediaLibrary }))
)
const AddMedia = lazy(() => import('../../pages/AddMedia').then((m) => ({ default: m.AddMedia })))
const MediaDetail = lazy(() =>
  import('../../pages/MediaDetail').then((m) => ({ default: m.MediaDetail }))
)

const section = mediaSections.libros

/**
 * Tracker de libros: todo lo que vive bajo /libros. Por ahora usa las pantallas
 * genéricas de src/pages; acá es donde va a vivir su diseño propio (librero).
 */
export function BooksTracker() {
  return (
    <div data-tracker="libros">
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<MediaLibrary sectionId="libros" />} />
          <Route path="agregar" element={<AddMedia sectionId="libros" />} />
          <Route path=":id" element={<MediaDetail sectionId="libros" />} />
        </Routes>
      </Suspense>
      <MediaTrackerNav section={section} />
    </div>
  )
}

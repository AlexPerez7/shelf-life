import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Bookmark, BookOpen, BookOpenCheck, Library as LibraryIcon } from 'lucide-react'
import '@fontsource-variable/lora'
import { TrackerNav } from '../../components/TrackerNav'
import { mediaSections } from '../../lib/media'
import { BooksLibrary } from './BooksLibrary'
import { shelfParam } from './bookLists'

const AddMedia = lazy(() => import('../../pages/AddMedia').then((m) => ({ default: m.AddMedia })))
const MediaDetail = lazy(() =>
  import('../../pages/MediaDetail').then((m) => ({ default: m.MediaDetail }))
)

const section = mediaSections.libros
/** Color de la barra de estado del sistema con el tema claro. */
const PAPER = '#f6f2e9'

/**
 * Activa el tema claro de Libros en <body> (cubre fondo, hojas inferiores y
 * avisos) y la barra de estado del teléfono, mientras se está en el tracker.
 */
function useBooksTheme() {
  useEffect(() => {
    document.body.dataset.theme = 'libros'
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previous = meta?.content
    if (meta) meta.content = PAPER
    return () => {
      delete document.body.dataset.theme
      if (meta && previous) meta.content = previous
    }
  }, [])
}

/** Estantes a los que lleva la barra inferior. */
const shelfLink = (shelf: string) => `${section.libraryPath}?${shelfParam}=${shelf}`
const isShelf = (shelf: string) => (pathname: string, search: URLSearchParams) =>
  pathname === section.libraryPath && search.get(shelfParam) === shelf

/**
 * Tracker de libros: todo lo que vive bajo /libros. Tiene su propio tema
 * (claro, serif, inspirado en Openreads) y su biblioteca es un librero; el alta y el
 * detalle todavía son las pantallas genéricas, que toman el tema solas.
 */
export function BooksTracker() {
  useBooksTheme()

  return (
    <div>
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<BooksLibrary />} />
          <Route path="agregar" element={<AddMedia sectionId="libros" />} />
          <Route path=":id" element={<MediaDetail sectionId="libros" />} />
        </Routes>
      </Suspense>
      <TrackerNav
        left={[
          {
            to: section.libraryPath,
            label: 'Librero',
            Icon: LibraryIcon,
            isActive: (pathname, search) =>
              pathname === section.libraryPath
                ? !search.get(shelfParam)
                : pathname.startsWith(`${section.libraryPath}/`) && pathname !== section.addPath,
          },
          { to: shelfLink('leyendo'), label: 'Leyendo', Icon: BookOpen, isActive: isShelf('leyendo') },
        ]}
        right={[
          { to: shelfLink('por-leer'), label: 'Por leer', Icon: Bookmark, isActive: isShelf('por-leer') },
          { to: shelfLink('leidos'), label: 'Leídos', Icon: BookOpenCheck, isActive: isShelf('leidos') },
        ]}
        add={{ to: section.addPath, label: 'Agregar libro' }}
      />
    </div>
  )
}

import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { BarChart3, Bookmark, BookOpen, Library as LibraryIcon } from 'lucide-react'
import '@fontsource-variable/lora'
import { TrackerNav } from '../../components/TrackerNav'
import { mediaSections } from '../../lib/media'
import { BooksLibrary } from './BooksLibrary'
import { shelfParam } from './bookLists'
import { useTrackerTheme } from '../useTrackerTheme'

const BookAdd = lazy(() => import('./BookAdd').then((m) => ({ default: m.BookAdd })))
const BookStats = lazy(() => import('./BookStats').then((m) => ({ default: m.BookStats })))
const BookDetail = lazy(() => import('./BookDetail').then((m) => ({ default: m.BookDetail })))

const section = mediaSections.libros
const statsPath = `${section.libraryPath}/estadisticas`
/** Estantes a los que lleva la barra inferior. */
const shelfLink = (shelf: string) => `${section.libraryPath}?${shelfParam}=${shelf}`
const isShelf = (shelf: string) => (pathname: string, search: URLSearchParams) =>
  pathname === section.libraryPath && search.get(shelfParam) === shelf

/**
 * Tracker de libros: todo lo que vive bajo /libros. Tiene su propio tema
 * (claro, serif, inspirado en Openreads): la biblioteca es un librero, el alta
 * busca en una lista con ficha y el detalle es la ficha del libro.
 */
export function BooksTracker() {
  useTrackerTheme('libros')

  return (
    <div>
      <Suspense fallback={null}>
        <Routes>
          <Route index element={<BooksLibrary />} />
          <Route path="agregar" element={<BookAdd />} />
          <Route path="estadisticas" element={<BookStats />} />
          <Route path=":id" element={<BookDetail />} />
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
                : pathname.startsWith(`${section.libraryPath}/`) &&
                  pathname !== section.addPath &&
                  pathname !== statsPath,
          },
          { to: shelfLink('leyendo'), label: 'Leyendo', Icon: BookOpen, isActive: isShelf('leyendo') },
        ]}
        right={[
          { to: shelfLink('por-leer'), label: 'Por leer', Icon: Bookmark, isActive: isShelf('por-leer') },
          { to: statsPath, label: 'Estadísticas', Icon: BarChart3 },
        ]}
        add={{ to: section.addPath, label: 'Agregar libro' }}
      />
    </div>
  )
}

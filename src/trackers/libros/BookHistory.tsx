import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { PageContainer } from '../../components/PageContainer'
import { HistoryFeed } from '../../components/HistoryFeed'
import { useActivity } from '../../hooks/useActivity'
import { mediaSections } from '../../lib/media'

const section = mediaSections.libros
const BOOK_TYPES = ['book' as const]

/** Diario de lectura: qué leíste cada día, desde las estadísticas. */
export function BookHistory() {
  const { items, loading } = useMedia()
  const activity = useActivity(BOOK_TYPES, null)
  const books = useMemo(() => items.filter((i) => i.media_type === 'book'), [items])

  return (
    <PageContainer>
      <Link
        to={`${section.libraryPath}/estadisticas`}
        className="-ml-2 mb-1 flex min-h-11 w-fit items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/15"
      >
        <ArrowLeft size={16} /> Estadísticas
      </Link>
      <h1 className="text-3xl font-bold text-ink">Diario de lectura</h1>
      <p className="mb-3 text-sm text-lavender">Lo que leíste, día por día</p>
      <HistoryFeed
        section={section}
        items={books}
        activity={activity}
        loading={loading}
        emptyText="Cuando sumes libros o guardes la página en la que vas, acá va a aparecer día por día."
        titleClassName="font-book"
      />
    </PageContainer>
  )
}

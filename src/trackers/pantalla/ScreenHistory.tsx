import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { PageContainer } from '../../components/PageContainer'
import { HistoryFeed } from '../../components/HistoryFeed'
import { useActivity } from '../../hooks/useActivity'
import { mediaSections } from '../../lib/media'

const section = mediaSections.pantalla

/** Historial de Pantalla: qué viste cada día, desde las estadísticas. */
export function ScreenHistory() {
  const { items, loading } = useMedia()
  const activity = useActivity(section.types, null)
  const screen = useMemo(
    () => items.filter((i) => (section.types as string[]).includes(i.media_type)),
    [items]
  )

  return (
    <PageContainer>
      <Link
        to={`${section.libraryPath}/estadisticas`}
        className="-ml-2 mb-1 flex min-h-11 w-fit items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/30"
      >
        <ArrowLeft size={16} /> Estadísticas
      </Link>
      <h1 className="mb-3 text-3xl font-bold text-ink">Historial</h1>
      <HistoryFeed
        section={section}
        items={screen}
        activity={activity}
        loading={loading}
        emptyText="Cuando agregues algo o registres lo que ves, acá va a aparecer día por día."
      />
    </PageContainer>
  )
}

import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useGames } from '../hooks/useGames'
import { useMedia } from '../contexts/MediaContext'
import { PageContainer } from '../components/PageContainer'
import { GameThumb } from '../components/GameThumb'
import { asset } from '../lib/appUrl'
import { mediaSections } from '../lib/media'
import { gamesPaths } from '../trackers/juegos/paths'
import { trackers, trackerIds, type TrackerId } from '../trackers/trackers'

interface Summary {
  total: number
  inProgress: number
  inProgressLabel: string
  /** Lo que está en curso (o lo último agregado), para la tira de portadas. */
  covers: { id: string; title: string; cover: string | null; to: string }[]
}

const COVERS = 4

function TrackerCard({ id, summary, loading }: { id: TrackerId; summary: Summary; loading: boolean }) {
  const { label, Icon, base, tagline } = trackers[id]
  return (
    <section
      data-tracker={id}
      className="overflow-hidden rounded-3xl bg-background-surface ring-1 ring-primary-dark/30"
    >
      <Link to={base} className="flex items-center gap-4 p-4 active:bg-primary-dark/10">
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <Icon size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink">{label}</h2>
          <p className="truncate text-sm text-lavender">
            {loading
              ? tagline
              : summary.total === 0
                ? tagline
                : `${summary.total} en total${summary.inProgress ? ` · ${summary.inProgress} ${summary.inProgressLabel.toLowerCase()}` : ''}`}
          </p>
        </div>
        <ChevronRight size={20} className="text-accent" />
      </Link>

      {summary.covers.length > 0 && (
        <div className="grid grid-cols-4 gap-2 px-4 pb-4">
          {summary.covers.map((c) => (
            <Link
              key={c.id}
              to={c.to}
              aria-label={c.title}
              className="aspect-[2/3] overflow-hidden rounded-lg bg-primary-dark/20 ring-1 ring-primary-dark/30 transition-transform active:scale-95"
            >
              <GameThumb
                src={c.cover}
                alt=""
                className="h-full w-full object-cover"
                placeholderClassName="text-xl"
                icon={Icon}
              />
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

/** Inicio de Shelf Life: desde acá se entra a cada tracker. */
export function Hub() {
  const { games, loading: loadingGames } = useGames()
  const { items, loading: loadingMedia } = useMedia()

  const gamesActive = games.filter((g) => g.status === 'jugando')
  const summaries: Record<TrackerId, Summary> = {
    juegos: {
      total: games.length,
      inProgress: gamesActive.length,
      inProgressLabel: 'Jugando',
      covers: (gamesActive.length ? gamesActive : games).slice(0, COVERS).map((g) => ({
        id: g.id,
        title: g.title,
        cover: g.cover_url,
        to: gamesPaths.game(g.id),
      })),
    },
    pantalla: mediaSummary('pantalla'),
    libros: mediaSummary('libros'),
  }

  function mediaSummary(sectionId: 'pantalla' | 'libros'): Summary {
    const section = mediaSections[sectionId]
    const own = items.filter((i) => (section.types as string[]).includes(i.media_type))
    const active = own.filter((i) => i.status === 'in_progress')
    return {
      total: own.length,
      inProgress: active.length,
      inProgressLabel: section.statusLabels.in_progress,
      covers: (active.length ? active : own).slice(0, COVERS).map((i) => ({
        id: i.id,
        title: i.title,
        cover: i.cover_url,
        to: section.detailPath(i.id),
      })),
    }
  }

  return (
    <PageContainer>
      <header className="mb-6 flex items-center gap-3">
        <img
          src={asset('icons/icon-192.png')}
          alt=""
          className="h-12 w-12 rounded-2xl shadow-lg shadow-black/40"
        />
        <div>
          <h1 className="text-2xl font-bold text-accent">Shelf Life</h1>
          <p className="text-sm text-lavender">¿Qué vas a registrar hoy?</p>
        </div>
      </header>

      <div className="flex flex-col gap-4 md:mx-auto md:max-w-xl">
        {trackerIds.map((id) => (
          <TrackerCard
            key={id}
            id={id}
            summary={summaries[id]}
            loading={id === 'juegos' ? loadingGames : loadingMedia}
          />
        ))}
      </div>
    </PageContainer>
  )
}

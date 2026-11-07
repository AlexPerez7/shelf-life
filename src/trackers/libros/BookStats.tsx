import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BookOpenCheck,
  CalendarDays,
  Clock,
  Disc3,
  Feather,
  FileText,
  Gauge,
  History,
  Hourglass,
  Layers,
  Rabbit,
  Ruler,
  Star,
  Tag,
  Turtle,
  Zap,
} from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { PageContainer } from '../../components/PageContainer'
import { TrackerBar } from '../../components/TrackerBar'
import { SectionCard } from '../../components/SectionCard'
import { Chip } from '../../components/Chip'
import { Skeleton } from '../../components/Skeleton'
import { GameThumb } from '../../components/GameThumb'
import { MonthlyBars } from '../../components/stats/MonthlyBars'
import { RankBars } from '../../components/stats/RankBars'
import { StatTile } from '../../components/stats/StatTile'
import { Highlight } from '../../components/stats/Highlight'
import { YearRecap } from '../../components/stats/YearRecap'
import { GoalCard } from '../../components/stats/GoalCard'
import { useActivity } from '../../hooks/useActivity'
import { formatMinutes, itemStatuses, mediaSections } from '../../lib/media'
import { finishedIn, maxBy, minBy, started, topCounts, yearBuckets } from '../../lib/stats'
import { fastestAndSlowest, finishedByMonth, readingsInYear, yearAverages } from '../../lib/bookStats'
import { lastFinishIn } from '../../lib/readings'
import { readYears } from '../../lib/bookView'
import { parseDate } from '../../lib/dates'
import { plural } from '../../lib/text'
import type { Item } from '../../types/item'
import { shelfParam } from './bookLists'

const section = mediaSections.libros
const BOOK_TYPES = ['book' as const]

/** Páginas leídas de un libro: todas si está leído, si no hasta donde va. */
const pagesRead = (b: Item) => (b.status === 'completed' ? (b.progress_total ?? b.progress) : b.progress)

/** Los leídos del año, como una fila de portadas (lo primero que se quiere ver). */
function ReadThisYear({ books, year }: { books: Item[]; year: number }) {
  return (
    <SectionCard icon={BookOpenCheck} title={`Leídos en ${year}`}>
      {books.length === 0 ? (
        <p className="text-sm text-lavender">Todavía ninguno este año. ¡El próximo puede ser el primero!</p>
      ) : (
        <div className="scrollbar-hide -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
          {books.map((b) => (
            <Link
              key={b.id}
              to={section.detailPath(b.id)}
              aria-label={b.title}
              className="relative h-28 w-[4.6rem] shrink-0 overflow-hidden rounded-[3px] bg-primary-dark/20 shadow-[0_3px_6px_rgba(0,0,0,0.25)] transition-transform active:-translate-y-1"
            >
              <GameThumb size="poster" src={b.cover_url} alt="" className="h-full w-full object-cover" icon={BookOpenCheck} />
              {!b.cover_url && (
                <span className="font-book absolute inset-x-1 bottom-1 line-clamp-3 text-center text-[9px] font-semibold leading-tight text-ink">
                  {b.title}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

/**
 * Estadísticas de Libros: totales, y de un año a elegir (metas, lo leído,
 * libros y páginas por mes, promedios, el más rápido y el más lento), más
 * géneros y autores, destacados y el resumen del año para compartir.
 */
export function BookStats() {
  const { items, loading } = useMedia()
  const activity = useActivity(BOOK_TYPES, null)
  const thisYear = new Date().getFullYear()

  const books = useMemo(() => items.filter((i) => i.media_type === 'book'), [items])

  // El año a mirar vive en la URL (?anio=); por defecto, el actual.
  const [params, setParams] = useSearchParams()
  const years = useMemo(() => [...new Set([thisYear, ...readYears(books)])].sort((a, b) => b - a), [books, thisYear])
  const asked = Number(params.get('anio'))
  const year = years.includes(asked) ? asked : thisYear
  function pickYear(y: number) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (y === thisYear) next.delete('anio')
        else next.set('anio', String(y))
        return next
      },
      { replace: true }
    )
  }

  const readThisYear = useMemo(() => finishedIn(books, thisYear).length, [books, thisYear])
  const yearReadings = useMemo(() => readingsInYear(books, year), [books, year])
  const averages = useMemo(() => yearAverages(yearReadings), [yearReadings])
  const extremes = useMemo(() => fastestAndSlowest(yearReadings), [yearReadings])
  const finishedMonths = useMemo(() => finishedByMonth(yearReadings, year), [yearReadings, year])
  // Mes elegido al abrir: el actual, o el último con algo si es un año pasado.
  const defaultMonth = (values: number[]) =>
    year === thisYear ? new Date().getMonth() : Math.max(0, values.findLastIndex((v) => v > 0))

  const stats = useMemo(() => {
    const read = books.filter((b) => b.status === 'completed')
    const pages = books.reduce((s, b) => s + pagesRead(b), 0)
    const minutes = books.reduce((s, b) => s + b.time_spent_minutes, 0)
    // Ritmo: solo con libros que tienen tiempo registrado (si no, las páginas
    // cargadas sin minutos lo inflarían).
    const timed = books.filter((b) => b.time_spent_minutes > 0 && b.progress > 0)
    const timedPages = timed.reduce((s, b) => s + b.progress, 0)
    const timedMinutes = timed.reduce((s, b) => s + b.time_spent_minutes, 0)
    const pagesPerHour = timedMinutes >= 30 ? Math.round((timedPages / timedMinutes) * 60) : null
    const withPages = read.filter((b) => b.progress_total)
    const avgLength = withPages.length
      ? Math.round(withPages.reduce((s, b) => s + (b.progress_total ?? 0), 0) / withPages.length)
      : null

    return {
      read,
      pages,
      minutes,
      pagesPerHour,
      avgLength,
      // Por la última vez que se terminó en el año (un libro releído puede estar leyéndose otra vez).
      yearBooks: finishedIn(books, year).sort((a, b) =>
        (lastFinishIn(b, year) ?? '').localeCompare(lastFinishIn(a, year) ?? '')
      ),
      genres: topCounts(started(books).flatMap((b) => b.genres), 6),
      authors: topCounts(started(books).flatMap((b) => b.metadata.authors ?? []), 5),
      formats: topCounts(
        books.flatMap((b) => (b.format ?? '').split(',').map((f) => f.trim()).filter(Boolean)),
        6
      ),
      byStatus: itemStatuses
        .map((s) => ({ status: s, count: books.filter((b) => b.status === s).length }))
        .filter((r) => r.count > 0),
      topRated: maxBy(books, (b) => b.rating),
      longest: maxBy(read, (b) => b.progress_total),
      shortest: minBy(read, (b) => b.progress_total),
    }
  }, [books, year])

  const months = useMemo(
    () =>
      activity
        ? {
            pages: yearBuckets(activity, year, (r) => r.occurred_at, (r) => Math.max(0, r.progress_delta ?? 0)),
            minutes: yearBuckets(activity, year, (r) => r.occurred_at, (r) => r.duration_minutes ?? 0),
          }
        : null,
    [activity, year]
  )

  // Racha: días seguidos con lectura registrada, hasta hoy o ayer.
  const streak = useMemo(() => {
    if (!activity) return 0
    const days = new Set(
      activity
        .filter((r) => (r.progress_delta ?? 0) > 0)
        .map((r) => {
          const d = parseDate(r.occurred_at)
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
        })
    )
    const d = new Date()
    const key = () => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    if (!days.has(key())) d.setDate(d.getDate() - 1)
    let count = 0
    while (days.has(key())) {
      count++
      d.setDate(d.getDate() - 1)
    }
    return count
  }, [activity])

  const recapLines = useMemo(() => {
    const yearActivity = (activity ?? []).filter((r) => parseDate(r.occurred_at).getFullYear() === year)
    const pages = yearActivity.reduce((s, r) => s + Math.max(0, r.progress_delta ?? 0), 0)
    const minutes = yearActivity.reduce((s, r) => s + (r.duration_minutes ?? 0), 0)
    const best = maxBy(stats.yearBooks, (b) => b.rating)
    const author = topCounts(stats.yearBooks.flatMap((b) => b.metadata.authors ?? []), 1)[0]
    return [
      stats.yearBooks.length > 0 && `📚 ${plural(stats.yearBooks.length, 'libro leído', 'libros leídos')}`,
      pages > 0 && `📄 ${plural(pages, 'página')}`,
      minutes > 0 && `⏱️ ${formatMinutes(minutes)} de lectura`,
      best && `⭐ Mi favorito: ${best.title}`,
      author && author.value > 1 && `✍️ Autor del año: ${author.label}`,
    ].filter(Boolean) as string[]
  }, [activity, stats.yearBooks, year])

  const highlights = [
    stats.topRated && {
      icon: Star,
      label: 'Mejor puntuado',
      item: stats.topRated,
      detail: '★'.repeat(Math.round((stats.topRated.rating ?? 0) / 2)),
    },
    stats.longest && {
      icon: Ruler,
      label: 'El más largo que leíste',
      item: stats.longest,
      detail: `${stats.longest.progress_total} págs.`,
    },
    stats.shortest &&
      stats.shortest.id !== stats.longest?.id && {
        icon: Zap,
        label: 'El más corto',
        item: stats.shortest,
        detail: `${stats.shortest.progress_total} págs.`,
      },
  ].filter(Boolean) as { icon: typeof Star; label: string; item: Item; detail: string }[]

  return (
    <PageContainer>
      <TrackerBar tracker="libros" />
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold text-ink">Estadísticas</h1>
          <p className="text-sm text-lavender">Tu vida lectora en números</p>
        </div>
        <Link
          to={`${section.libraryPath}/historial`}
          className="-mr-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-medium text-accent active:bg-primary-dark/15"
        >
          <History size={16} /> Diario
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <p className="font-book mt-8 text-center text-sm text-lavender">
          Cuando sumes libros a tu librero, acá vas a ver tus números.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile
              icon={BookOpenCheck}
              label="Libros leídos"
              value={String(stats.read.length)}
              hint={readThisYear ? `${readThisYear} este año` : undefined}
              to={`${section.libraryPath}?${shelfParam}=leidos`}
            />
            <StatTile icon={FileText} label="Páginas leídas" value={stats.pages.toLocaleString('es')} />
            <StatTile
              icon={Clock}
              label="Tiempo de lectura"
              value={stats.minutes ? formatMinutes(stats.minutes) : '—'}
            />
            <StatTile
              icon={Gauge}
              label="Ritmo"
              value={stats.pagesPerHour ? `${stats.pagesPerHour} págs/h` : '—'}
              hint={stats.avgLength ? `Promedio ${stats.avgLength} págs./libro` : undefined}
            />
          </div>

          {/* Todo lo que sigue hasta la racha es del año elegido. */}
          <div className="flex items-center gap-2" role="group" aria-label="Año a mirar">
            <CalendarDays size={18} className="shrink-0 text-accent" />
            <div className="scrollbar-hide -mr-4 flex gap-2 overflow-x-auto pr-4">
              {years.map((y) => (
                <Chip key={y} active={y === year} onClick={() => pickYear(y)}>
                  {y}
                </Chip>
              ))}
            </div>
          </div>

          <GoalCard key={`items-${year}`} tracker="libros" year={year} />
          <GoalCard key={`pages-${year}`} tracker="libros" year={year} kind="pages" />

          <ReadThisYear books={stats.yearBooks} year={year} />

          <MonthlyBars
            key={`books-${year}`}
            icon={BookOpenCheck}
            title={`Libros terminados en ${year}`}
            months={finishedMonths}
            format={(v) => plural(v, 'libro')}
            emptyText={`No terminaste ningún libro en ${year}.`}
            defaultIndex={defaultMonth(finishedMonths.map((m) => m.value))}
            detail={(i) => {
              const titles = yearReadings
                .filter((r) => parseDate(r.finished).getMonth() === i)
                .map((r) => r.item.title)
              if (titles.length === 0) return null
              return titles.length > 3 ? `${titles.slice(0, 3).join(' · ')} y ${titles.length - 3} más` : titles.join(' · ')
            }}
          />

          <MonthlyBars
            key={`pages-${year}`}
            icon={FileText}
            title={`Páginas por mes en ${year}`}
            months={months?.pages ?? null}
            format={(v) => plural(v, 'página')}
            emptyText="Guarda la página en la que vas desde la ficha de un libro para ver tu ritmo mes a mes."
            defaultIndex={months ? defaultMonth(months.pages.map((m) => m.value)) : undefined}
            detail={(i) =>
              months && months.minutes[i].value > 0 ? `${formatMinutes(months.minutes[i].value)} de lectura` : null
            }
          />

          {yearReadings.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatTile
                  icon={Star}
                  label="Puntaje promedio"
                  value={averages.rating != null ? `${averages.rating.toLocaleString('es')} ★` : '—'}
                />
                <StatTile
                  icon={FileText}
                  label="Páginas por libro"
                  value={averages.pages != null ? averages.pages.toLocaleString('es') : '—'}
                />
                <StatTile
                  icon={Hourglass}
                  label="Tiempo por libro"
                  value={averages.minutes != null ? formatMinutes(averages.minutes) : '—'}
                />
                <StatTile
                  icon={CalendarDays}
                  label="Días por libro"
                  value={averages.days != null ? String(averages.days) : '—'}
                  hint="De empezarlo a terminarlo"
                />
              </div>

              {(extremes.fastest || extremes.slowest) && (
                <div className="grid gap-2 md:grid-cols-2">
                  {extremes.fastest && (
                    <Highlight
                      icon={Rabbit}
                      label={`El que leíste más rápido en ${year}`}
                      title={extremes.fastest.item.title}
                      detail={plural(extremes.fastest.days, 'día')}
                      cover={extremes.fastest.item.cover_url}
                      to={section.detailPath(extremes.fastest.item.id)}
                    />
                  )}
                  {extremes.slowest && (
                    <Highlight
                      icon={Turtle}
                      label={`El que leíste más lento en ${year}`}
                      title={extremes.slowest.item.title}
                      detail={plural(extremes.slowest.days, 'día')}
                      cover={extremes.slowest.item.cover_url}
                      to={section.detailPath(extremes.slowest.item.id)}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {streak >= 2 && (
            <div className="flex items-center gap-3 rounded-2xl bg-background-surface p-3.5 shadow-sm ring-1 ring-primary-dark/20">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <Zap size={20} />
              </div>
              <div>
                <p className="text-xs text-lavender">Racha de lectura</p>
                <p className="font-book font-semibold text-ink">{plural(streak, 'día seguido', 'días seguidos')}</p>
              </div>
            </div>
          )}

          {stats.genres.length > 0 && (
            <SectionCard icon={Tag} title="Géneros que más lees">
              <RankBars rows={stats.genres} />
            </SectionCard>
          )}

          {stats.formats.length > 0 && (
            <SectionCard icon={Disc3} title="Cómo lees">
              <RankBars
                rows={stats.formats.map((f) => ({
                  ...f,
                  to: `${section.libraryPath}?${shelfParam}=${encodeURIComponent(`formato:${f.label}`)}`,
                }))}
              />
            </SectionCard>
          )}

          {stats.authors.length > 0 && stats.authors[0].value > 1 && (
            <SectionCard icon={Feather} title="Autores que más lees">
              <RankBars rows={stats.authors} />
            </SectionCard>
          )}

          <SectionCard icon={Layers} title="Por estado">
            <RankBars
              rows={stats.byStatus.map((r) => ({ label: section.statusLabels[r.status], value: r.count }))}
            />
          </SectionCard>

          {highlights.length > 0 && (
            <div className="grid gap-2 md:grid-cols-2">
              {highlights.map((h) => (
                <Highlight
                  key={h.label}
                  icon={h.icon}
                  label={h.label}
                  title={h.item.title}
                  detail={h.detail}
                  cover={h.item.cover_url}
                  to={section.detailPath(h.item.id)}
                />
              ))}
            </div>
          )}

          <YearRecap year={year} heading={`Mi ${year} lector en Shelf Life 📚`} lines={recapLines} />
        </div>
      )}
    </PageContainer>
  )
}

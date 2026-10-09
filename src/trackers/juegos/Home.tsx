import { useEffect, useMemo, useRef, useState } from 'react'
import { Bookmark, Gamepad2, Plus } from 'lucide-react'
import { getCachedPopularGames, getPopularGames, igdbResultToNewGame } from '../../lib/igdb'
import { useGames } from '../../hooks/useGames'
import { useToast } from '../../contexts/ToastContext'
import { PageContainer } from '../../components/PageContainer'
import { TrackerBar } from '../../components/TrackerBar'
import { TagList } from '../../components/TagList'
import { PopularCardSkeleton } from '../../components/Skeleton'
import type { GameStatus, IgdbSearchResult } from '../../types/game'

const PULL_THRESHOLD = 60

export function Home() {
  const { games, addGame } = useGames()
  const { showToast, showError } = useToast()
  // Se pinta al instante lo último guardado; solo se muestran esqueletos la
  // primera vez que se abre Inicio.
  const [cached] = useState(getCachedPopularGames)
  const [popular, setPopular] = useState<IgdbSearchResult[]>(cached?.data ?? [])
  const [loading, setLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<number | null>(null)

  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullDistanceRef = useRef(0)

  async function loadPopular() {
    try {
      const data = await getPopularGames()
      setPopular(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando populares')
    }
  }

  useEffect(() => {
    if (cached?.fresh) return
    loadPopular().finally(() => setLoading(false))
  }, [cached])

  useEffect(() => {
    let startY = 0
    let tracking = false

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY === 0 && !refreshing) {
        startY = e.touches[0].clientY
        tracking = true
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!tracking) return
      const delta = e.touches[0].clientY - startY
      if (delta > 0) {
        const clamped = Math.min(delta, 100)
        pullDistanceRef.current = clamped
        setPullDistance(clamped)
      }
    }

    async function onTouchEnd() {
      if (!tracking) return
      tracking = false
      if (pullDistanceRef.current > PULL_THRESHOLD) {
        setRefreshing(true)
        await loadPopular()
        setRefreshing(false)
      }
      pullDistanceRef.current = 0
      setPullDistance(0)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [refreshing])

  const ownedIgdbIds = useMemo(
    () => new Set(games.map((g) => g.igdb_id).filter((id): id is number => id != null)),
    [games]
  )

  async function handleQuickAdd(result: IgdbSearchResult, status: GameStatus) {
    setAddingId(result.id)
    try {
      await addGame({ ...igdbResultToNewGame(result), status })
      showToast(
        status === 'deseado'
          ? `${result.name} guardado en deseados`
          : `${result.name} agregado a tu biblioteca`
      )
    } catch (err) {
      showError(err, 'No se pudo agregar el juego')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <PageContainer>
      <div
        className="flex items-center justify-center overflow-hidden text-xs text-lavender transition-[height]"
        style={{ height: refreshing ? 32 : pullDistance * 0.4 }}
      >
        {refreshing
          ? 'Actualizando...'
          : pullDistance > PULL_THRESHOLD
            ? 'Suelta para actualizar'
            : pullDistance > 0
              ? '↓'
              : ''}
      </div>

      <TrackerBar tracker="juegos" />
      <h1 className="mb-1 text-xl font-semibold">Descubrir</h1>
      <p className="mb-4 text-sm text-lavender">
        Juegos con más repercusión salidos en los últimos 2 años
      </p>

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {loading &&
          Array.from({ length: 8 }).map((_, i) => <PopularCardSkeleton key={i} />)}
        {!loading && popular.map((result) => {
          const alreadyOwned = ownedIgdbIds.has(result.id)
          return (
            <div
              key={result.id}
              className="flex flex-col overflow-hidden rounded-lg bg-background-surface ring-1 ring-primary-dark/30"
            >
              <div className="aspect-[3/4] w-full bg-primary-dark/20">
                {result.cover_url ? (
                  <img
                    src={result.cover_url}
                    alt={result.name}
                    loading="lazy"
                    decoding="async"
                    width={264}
                    height={352}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Gamepad2 className="text-lavender/50" size={28} />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <p className="line-clamp-2 text-sm font-medium text-ink">
                  {result.name}
                </p>
                <TagList value={result.genres.slice(0, 2).join(', ')} />
                {alreadyOwned ? (
                  <p className="mt-auto flex min-h-10 items-center justify-center rounded-lg bg-primary-dark/20 text-xs text-lavender">
                    En tu biblioteca
                  </p>
                ) : (
                  <div className="mt-auto flex gap-1.5">
                    <button
                      onClick={() => handleQuickAdd(result, 'pendiente')}
                      disabled={addingId === result.id}
                      className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-primary text-xs font-semibold text-white disabled:opacity-40"
                    >
                      {addingId === result.id ? (
                        '...'
                      ) : (
                        <>
                          <Plus size={14} /> Agregar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleQuickAdd(result, 'deseado')}
                      disabled={addingId === result.id}
                      aria-label={`Guardar ${result.name} en deseados`}
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning ring-1 ring-warning/40 disabled:opacity-40"
                    >
                      <Bookmark size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </PageContainer>
  )
}

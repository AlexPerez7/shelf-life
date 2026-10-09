import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SiSteam } from 'react-icons/si'
import { ArrowLeft, Check, Download, Loader2, RefreshCw, Search, Sparkles, X } from 'lucide-react'
import {
  disconnectSteam,
  getSteamLibrary,
  getSteamProfile,
  startSteamLogin,
  steamGameToNewGame,
  type SteamGame,
  type SteamProfile,
} from '../lib/steam'
import { useGames } from '../hooks/useGames'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { getIgdbBySteamAppIds } from '../lib/igdb'
import { Chip } from '../components/Chip'
import { plural } from '../lib/text'
import type { Game, IgdbSearchResult } from '../types/game'
import { PageContainer } from '../components/PageContainer'
import { PopularCardSkeleton } from '../components/Skeleton'
import { GameThumb } from '../components/GameThumb'

function PrivacyNote() {
  return (
    <div className="rounded-lg bg-background-surface p-3 text-xs leading-relaxed text-lavender ring-1 ring-primary-dark/30">
      <p className="mb-1 font-medium text-lavender">Requisitos</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          Tu perfil de Steam debe estar <strong>público</strong>: en Steam →
          Perfil → Editar perfil → Privacidad, pon <em>Mi perfil</em> y{' '}
          <em>Detalles del juego</em> en <strong>Público</strong>.
        </li>
        <li>
          Revisa que <em>"Mantener siempre privado mi total de horas jugadas"</em>{' '}
          esté desactivado, si quieres que se importen las horas.
        </li>
        <li>
          Solo leemos tu lista de juegos y horas jugadas. No publicamos nada ni
          modificamos tu cuenta de Steam.
        </li>
      </ul>
    </div>
  )
}

type SteamSort = 'horas' | 'nombre'

// Appids que IGDB no reconoció: no se vuelven a ofrecer para "Completar datos"
// (si no, el botón quedaría para siempre por juegos que IGDB no tiene).
const IGDB_MISS_KEY = 'playdex_igdb_steam_miss'

function readMisses(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(IGDB_MISS_KEY) ?? '[]') as number[])
  } catch {
    return new Set()
  }
}

function saveMisses(misses: Set<number>) {
  try {
    localStorage.setItem(IGDB_MISS_KEY, JSON.stringify([...misses]))
  } catch {
    /* no persistido: se volverá a intentar */
  }
}
type SteamFilter = 'todos' | 'faltan'

/** Trae la metadata de IGDB sin romper la importación si la función falla. */
async function safeIgdbLookup(appIds: number[]): Promise<Record<number, IgdbSearchResult>> {
  try {
    return await getIgdbBySteamAppIds(appIds)
  } catch {
    return {}
  }
}

/** Ejecuta `task` sobre cada ítem con, como mucho, `limit` en paralelo. */
async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0
  async function worker() {
    while (next < items.length) await task(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

export function SteamImport() {
  const navigate = useNavigate()
  const { games, addGame, addGames, updateGame } = useGames()
  const { showToast, showError } = useToast()
  const confirm = useConfirm()

  const [profile, setProfile] = useState<SteamProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const [library, setLibrary] = useState<SteamGame[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addingAppId, setAddingAppId] = useState<number | null>(null)

  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SteamSort>('horas')
  const [filter, setFilter] = useState<SteamFilter>('faltan')
  /** Tarea masiva en curso (importar / sincronizar / completar). */
  const [bulk, setBulk] = useState<{ label: string; done: number; total: number } | null>(null)
  const [igdbMisses, setIgdbMisses] = useState(readMisses)

  useEffect(() => {
    getSteamProfile()
      .then(setProfile)
      .finally(() => setProfileLoading(false))
  }, [])

  useEffect(() => {
    if (!profile) return
    setLibraryLoading(true)
    setError(null)
    getSteamLibrary()
      .then(setLibrary)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Error cargando tu biblioteca de Steam')
      )
      .finally(() => setLibraryLoading(false))
  }, [profile])

  async function handleConnect() {
    setConnecting(true)
    try {
      window.location.href = await startSteamLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el login de Steam')
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    const ok = await confirm({
      title: '¿Desvincular Steam?',
      message: 'Los juegos ya importados se quedan en tu biblioteca.',
      confirmLabel: 'Desvincular',
      danger: true,
    })
    if (!ok) return
    try {
      await disconnectSteam()
    } catch (err) {
      showError(err, 'No se pudo desvincular la cuenta')
      return
    }
    setProfile(null)
    setLibrary([])
    setError(null)
  }

  /** Juegos de la biblioteca de Shelf Life que vinieron de Steam, por appid. */
  const importedByAppId = useMemo(() => {
    const map = new Map<number, Game>()
    for (const g of games) if (g.steam_appid != null) map.set(g.steam_appid, g)
    return map
  }, [games])

  const missing = useMemo(
    () => library.filter((g) => !importedByAppId.has(g.appid)),
    [library, importedByAppId]
  )

  /** Importados cuyas horas en Steam son mayores que las de Shelf Life. */
  const outdated = useMemo(
    () =>
      library.flatMap((sg) => {
        const g = importedByAppId.get(sg.appid)
        return g && sg.hours_played > Number(g.hours_played) ? [{ game: g, hours: sg.hours_played }] : []
      }),
    [library, importedByAppId]
  )

  /** Importados de Steam que todavía no tienen datos de IGDB. */
  const withoutMetadata = useMemo(
    () =>
      games.filter(
        (g) => g.steam_appid != null && g.igdb_id == null && !igdbMisses.has(g.steam_appid)
      ),
    [games, igdbMisses]
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = (filter === 'faltan' ? missing : library).filter(
      (g) => q === '' || g.name.toLowerCase().includes(q)
    )
    return sort === 'nombre'
      ? [...list].sort((a, b) => a.name.localeCompare(b.name))
      : list // la función ya los devuelve ordenados por horas
  }, [library, missing, filter, search, sort])

  async function handleImport(game: SteamGame) {
    setAddingAppId(game.appid)
    try {
      const meta = await safeIgdbLookup([game.appid])
      await addGame(steamGameToNewGame(game, meta[game.appid]))
      showToast(`${game.name} importado`)
    } catch (err) {
      showError(err, 'No se pudo importar el juego')
    } finally {
      setAddingAppId(null)
    }
  }

  async function handleImportAll() {
    const toImport = missing
    if (toImport.length === 0) return
    const ok = await confirm({
      title: `¿Importar ${plural(toImport.length, 'juego')}?`,
      message:
        'Se agregan con sus horas de Steam: los que tienen horas como "Jugando" y el resto como "Pendiente". Después puedes cambiar el estado de cada uno.',
      confirmLabel: `Importar ${toImport.length}`,
    })
    if (!ok) return
    setBulk({ label: 'Buscando datos en IGDB', done: 0, total: toImport.length })
    try {
      const meta = await safeIgdbLookup(toImport.map((g) => g.appid))
      setBulk({ label: 'Importando', done: 0, total: toImport.length })
      const created = await addGames(toImport.map((g) => steamGameToNewGame(g, meta[g.appid])))
      showToast(`${plural(created.length, 'juego importado', 'juegos importados')}`)
    } catch (err) {
      showError(err, 'La importación se interrumpió')
    } finally {
      setBulk(null)
    }
  }

  async function handleSyncHours() {
    if (outdated.length === 0) return
    setBulk({ label: 'Actualizando horas', done: 0, total: outdated.length })
    let done = 0
    try {
      await runPool(outdated, 4, async ({ game, hours }) => {
        await updateGame(game.id, { hours_played: hours })
        setBulk((b) => b && { ...b, done: ++done })
      })
      showToast(`Horas actualizadas en ${plural(outdated.length, 'juego')}`)
    } catch (err) {
      showError(err, 'No se pudieron actualizar todas las horas')
    } finally {
      setBulk(null)
    }
  }

  async function handleEnrich() {
    const targets = withoutMetadata
    if (targets.length === 0) return
    setBulk({ label: 'Buscando datos en IGDB', done: 0, total: targets.length })
    let found = 0
    try {
      const meta = await getIgdbBySteamAppIds(targets.map((g) => g.steam_appid!))
      const matches = targets.flatMap((g) => (meta[g.steam_appid!] ? [{ g, m: meta[g.steam_appid!] }] : []))
      const misses = new Set(igdbMisses)
      for (const g of targets) if (!meta[g.steam_appid!]) misses.add(g.steam_appid!)
      saveMisses(misses)
      setIgdbMisses(misses)
      setBulk({ label: 'Completando datos', done: 0, total: matches.length })
      let done = 0
      await runPool(matches, 4, async ({ g, m }) => {
        await updateGame(g.id, {
          igdb_id: m.id,
          // Solo se completan campos vacíos: no pisar lo que editó el usuario.
          genre: g.genre || m.genres.join(', '),
          summary: g.summary || m.summary,
          first_release_date: g.first_release_date ?? m.first_release_date,
          // La portada vertical de IGDB reemplaza al banner horizontal de Steam.
          cover_url: m.cover_url && g.cover_url?.includes('steamstatic') ? m.cover_url : g.cover_url,
        })
        found++
        setBulk((b) => b && { ...b, done: ++done })
      })
      showToast(
        found > 0
          ? `Datos completados en ${plural(found, 'juego')}`
          : 'IGDB no tiene datos para esos juegos'
      )
    } catch (err) {
      showError(err, 'No se pudieron completar los datos')
    } finally {
      setBulk(null)
    }
  }

  return (
    <PageContainer>
      <button
        onClick={() => navigate('/add')}
        className="-ml-2 mb-2 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/20"
      >
        <ArrowLeft size={16} /> Volver
      </button>

      <h1 className="mb-1 text-xl font-semibold">Importar de Steam</h1>
      <p className="mb-4 text-sm text-lavender">
        Vincula tu cuenta de Steam para traer tus juegos con las horas jugadas reales.
      </p>

      {/* --- Sin cuenta vinculada --- */}
      {!profileLoading && !profile && (
        <div className="flex flex-col gap-4">
          <PrivacyNote />
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1b2838] px-4 text-sm font-medium text-white ring-1 ring-white/10 disabled:opacity-50"
          >
            <SiSteam size={18} />
            {connecting ? 'Redirigiendo a Steam...' : 'Iniciar sesión con Steam'}
          </button>
          {error && <p className="text-sm text-error">{error}</p>}
        </div>
      )}

      {/* --- Cuenta vinculada --- */}
      {profile && (
        <>
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-background-surface p-3 ring-1 ring-primary-dark/30">
            {profile.steam_avatar && (
              <img src={profile.steam_avatar} alt="" className="h-10 w-10 rounded" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{profile.steam_persona ?? 'Cuenta de Steam'}</p>
              <p className="text-xs text-lavender">
                Vinculada{library.length > 0 && ` · ${plural(library.length, 'juego')}`}
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              className="min-h-11 flex-shrink-0 rounded-full px-3 text-xs text-lavender underline active:bg-primary-dark/20"
            >
              Desvincular
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error ring-1 ring-error/40">
              <p>{error}</p>
              <div className="mt-2 text-error/70">
                <PrivacyNote />
              </div>
            </div>
          )}

          {/* Acciones masivas */}
          {!libraryLoading && !error && library.length > 0 && (
            <div className="mb-4 flex flex-col gap-2">
              {bulk ? (
                <div className="rounded-xl bg-background-surface p-3 ring-1 ring-primary-dark/30">
                  <div className="mb-2 flex items-center gap-2 text-sm text-ink">
                    <Loader2 size={16} className="animate-spin text-accent" />
                    {bulk.label}
                    {bulk.done > 0 && ` · ${bulk.done}/${bulk.total}`}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-primary-dark/30">
                    <div
                      className="h-full rounded-full bg-accent transition-[width]"
                      style={{ width: `${bulk.total ? Math.max(5, (bulk.done / bulk.total) * 100) : 5}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {missing.length > 0 && (
                    <button
                      onClick={handleImportAll}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white"
                    >
                      <Download size={18} />{' '}
                      {missing.length === 1 ? 'Importar el que falta' : `Importar los ${missing.length} que faltan`}
                    </button>
                  )}
                  {outdated.length > 0 && (
                    <button
                      onClick={handleSyncHours}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-background-surface text-sm font-medium text-ink ring-1 ring-primary-dark/30"
                    >
                      <RefreshCw size={16} /> Actualizar horas de {plural(outdated.length, 'juego')}
                    </button>
                  )}
                  {withoutMetadata.length > 0 && (
                    <button
                      onClick={handleEnrich}
                      className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-background-surface text-sm font-medium text-ink ring-1 ring-primary-dark/30"
                    >
                      <Sparkles size={16} /> Completar datos de {plural(withoutMetadata.length, 'juego')}
                    </button>
                  )}
                  {missing.length === 0 && outdated.length === 0 && (
                    <p className="flex items-center gap-2 text-sm text-lavender">
                      <Check size={16} className="text-accent" /> Tu biblioteca de Steam está al día.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {!libraryLoading && library.length > 0 && (
            <>
              <div className="relative mb-3">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lavender"
                />
                <input
                  type="search"
                  enterKeyHint="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar en tu biblioteca de Steam..."
                  aria-label="Buscar en tu biblioteca de Steam"
                  className="w-full rounded-xl bg-background-surface py-2.5 pl-9 pr-10 text-sm text-ink ring-1 ring-primary-dark/30 [&::-webkit-search-cancel-button]:hidden focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Borrar búsqueda"
                    className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-lavender"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="scrollbar-hide -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-1.5">
                <Chip active={filter === 'faltan'} onClick={() => setFilter('faltan')}>
                  Sin importar ({missing.length})
                </Chip>
                <Chip active={filter === 'todos'} onClick={() => setFilter('todos')}>
                  Todos ({library.length})
                </Chip>
                <Chip active={sort === 'horas'} onClick={() => setSort('horas')}>
                  Más horas
                </Chip>
                <Chip active={sort === 'nombre'} onClick={() => setSort('nombre')}>
                  A-Z
                </Chip>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {libraryLoading &&
              Array.from({ length: 6 }).map((_, i) => <PopularCardSkeleton key={i} />)}

            {!libraryLoading &&
              visible.map((game) => {
                const imported = importedByAppId.has(game.appid)
                return (
                  <div
                    key={game.appid}
                    className="flex items-center gap-3 rounded-xl bg-background-surface p-2 ring-1 ring-primary-dark/30 [contain-intrinsic-size:auto_64px] [content-visibility:auto]"
                  >
                    <GameThumb
                      src={game.cover_url}
                      alt=""
                      fallbacks={[
                        `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_hero.jpg`,
                      ]}
                      className="h-12 w-24 flex-shrink-0 rounded object-cover"
                      placeholderClassName="text-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{game.name}</p>
                      <p className="text-xs text-lavender">{game.hours_played}h jugadas</p>
                    </div>
                    {imported ? (
                      <span className="flex min-h-10 flex-shrink-0 items-center gap-1 px-2 text-xs text-lavender">
                        <Check size={14} className="text-accent" /> Importado
                      </span>
                    ) : (
                      <button
                        onClick={() => handleImport(game)}
                        disabled={addingAppId === game.appid || bulk != null}
                        className="min-h-10 flex-shrink-0 rounded-lg bg-primary px-3 text-xs font-semibold disabled:opacity-40"
                      >
                        {addingAppId === game.appid ? '...' : '+ Agregar'}
                      </button>
                    )}
                  </div>
                )
              })}
          </div>

          {!libraryLoading && !error && library.length === 0 && (
            <p className="text-sm text-lavender">Tu biblioteca de Steam está vacía.</p>
          )}
          {!libraryLoading && library.length > 0 && visible.length === 0 && (
            <p className="mt-6 text-center text-sm text-lavender">
              {filter === 'faltan' && !search
                ? 'Ya importaste todos tus juegos de Steam.'
                : 'Ningún juego coincide con la búsqueda.'}
            </p>
          )}
        </>
      )}
    </PageContainer>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Clapperboard, FileUp, Loader2, Tv } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { PageContainer } from '../../components/PageContainer'
import { GameThumb } from '../../components/GameThumb'
import { haptic } from '../../lib/haptics'
import { mediaSections } from '../../lib/media'
import { plural } from '../../lib/text'
import { gunzip, isGzip, isZip, readZipTexts } from '../../lib/zip'
import {
  existingScreenKeys,
  importedScreenToItem,
  isLetterboxdFile,
  isScreenDuplicate,
  MAL_BATCH,
  MATCH_BATCH,
  matchAnime,
  matchMovies,
  parseLetterboxdExport,
  parseMalExport,
  type ImportedScreen,
  type ScreenImportSource,
  type ScreenMatch,
} from '../../lib/screenImport'

const section = mediaSections.pantalla

const SOURCE_NAMES: Record<ScreenImportSource, string> = { letterboxd: 'Letterboxd', myanimelist: 'MyAnimeList' }

interface Row {
  entry: ImportedScreen
  match: ScreenMatch
}

/** Cómo exportar desde cada app (lo primero que se lee en la pantalla). */
function HowTo() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-2xl bg-background-surface p-4 ring-1 ring-primary-dark/40">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Clapperboard size={16} className="text-accent" /> Letterboxd
        </p>
        <p className="mt-1 text-lavender">
          En la web: <span className="text-ink">Settings → Data → Export your data</span>. Baja un{' '}
          <span className="text-ink">.zip</span>: elígelo tal cual (o los .csv de adentro).
        </p>
      </div>
      <div className="rounded-2xl bg-background-surface p-4 ring-1 ring-primary-dark/40">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <Tv size={16} className="text-accent" /> MyAnimeList
        </p>
        <p className="mt-1 text-lavender">
          En la web: <span className="text-ink">Profile → Export</span> (o{' '}
          <span className="text-ink">myanimelist.net/panel.php?go=export</span>), elige{' '}
          <span className="text-ink">Anime List</span> y descarga el <span className="text-ink">.xml.gz</span>.
        </p>
      </div>
    </div>
  )
}

/** Lee lo elegido: el .zip o los .csv de Letterboxd, o el .xml(.gz) de MyAnimeList. */
async function readExport(files: File[]): Promise<{ source: ScreenImportSource; entries: ImportedScreen[] }> {
  const decoder = new TextDecoder()
  const texts = new Map<string, string>()
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (isZip(bytes)) {
      for (const [name, text] of await readZipTexts(bytes, isLetterboxdFile)) texts.set(name, text)
    } else {
      texts.set(file.name, decoder.decode(isGzip(bytes) ? await gunzip(bytes) : bytes))
    }
  }
  const xml = [...texts.values()].find((t) => /<myanimelist>/.test(t))
  if (xml) return { source: 'myanimelist', entries: parseMalExport(xml) }
  return { source: 'letterboxd', entries: parseLetterboxdExport(texts) }
}

/**
 * Importar Pantalla desde Letterboxd (películas) o MyAnimeList (anime): se
 * elige el archivo que exportan, cada título se busca en TMDB o AniList para
 * traer portada y datos, se ve un resumen (lo que ya está se salta; lo que no
 * se encontró se puede agregar igual) y se importa.
 */
export function ScreenImport() {
  const { items, addItems } = useMedia()
  const { showError } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [source, setSource] = useState<ScreenImportSource | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [matching, setMatching] = useState<{ done: number; total: number } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  /** Sin coincidencia que se agregan igual (por `entry.key`). */
  const [extra, setExtra] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(0)
  const [finished, setFinished] = useState<number | null>(null)

  const screenItems = useMemo(() => items.filter((i) => (section.types as string[]).includes(i.media_type)), [items])

  // Cada archivo nuevo corta la búsqueda del anterior (y salir de la pantalla también).
  const runId = useRef(0)
  useEffect(() => () => void runId.current++, [])

  async function handleFiles(list: FileList | null) {
    const files = [...(list ?? [])]
    if (files.length === 0) return
    const run = ++runId.current
    setFileError(null)
    setFinished(null)
    setRows(null)
    setExtra(new Set())
    try {
      const parsed = await readExport(files)
      if (parsed.entries.length === 0) throw new Error('El archivo no tiene títulos.')

      // Lo que ya está por título y año no se busca.
      const keys = existingScreenKeys(screenItems)
      const pending = parsed.entries.filter((e) => !isScreenDuplicate(e, null, keys))
      const isMal = parsed.source === 'myanimelist'
      const size = isMal ? MAL_BATCH : MATCH_BATCH
      const batches: ImportedScreen[][] = []
      for (let i = 0; i < pending.length; i += size) batches.push(pending.slice(i, i + size))

      setSource(parsed.source)
      setMatching({ done: 0, total: pending.length })
      const matches: ScreenMatch[][] = []
      let found = 0
      // De a dos tandas a la vez: rápido sin pasarse del límite de TMDB.
      let next = 0
      const worker = async () => {
        while (next < batches.length) {
          const i = next++
          matches[i] = await (isMal ? matchAnime(batches[i]) : matchMovies(batches[i]))
          if (run !== runId.current) return
          found += batches[i].length
          setMatching({ done: found, total: pending.length })
        }
      }
      await Promise.all([worker(), worker()])
      if (run !== runId.current) return

      // Fuera lo que ya estaba (ahora también por id) y lo repetido en el archivo.
      const result: Row[] = []
      pending.forEach((entry, i) => {
        const match = matches[Math.floor(i / size)][i % size]
        if (isScreenDuplicate(entry, match, keys)) return
        if (match) keys.add(`id:${match.source}:${match.external_id}`)
        result.push({ entry, match })
      })
      setSkipped(parsed.entries.length - result.length)
      setRows(result)
    } catch (err) {
      if (run !== runId.current) return
      setSource(null)
      setFileError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      if (run === runId.current) setMatching(null)
    }
  }

  const plan = useMemo(() => {
    if (!rows) return null
    const unmatched = rows.filter((r) => !r.match)
    const toImport = rows.filter((r) => r.match || extra.has(r.entry.key))
    const count = (s: ImportedScreen['status'][]) => toImport.filter((r) => s.includes(r.entry.status)).length
    return {
      toImport,
      unmatched,
      seen: count(['completed']),
      watching: count(['in_progress']),
      paused: count(['paused']),
      toWatch: count(['wishlist', 'planned']),
      dropped: count(['dropped']),
    }
  }, [rows, extra])

  function toggleExtra(key: string) {
    haptic()
    setExtra((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleImport() {
    if (!plan || plan.toImport.length === 0) return
    haptic()
    setImporting(true)
    setDone(0)
    try {
      const created = await addItems(
        plan.toImport.map((r) => importedScreenToItem(r.entry, r.match)),
        setDone
      )
      setFinished(created.length)
      setRows(null)
    } catch (err) {
      showError(err, 'La importación se cortó; lo que alcanzó a entrar quedó en Pantalla')
    } finally {
      setImporting(false)
    }
  }

  const noun = source === 'myanimelist' ? 'anime' : 'película'
  const nouns = source === 'myanimelist' ? 'anime' : 'películas'
  const labels = section.statusLabels

  return (
    <PageContainer>
      <Link
        to={section.addPath}
        className="-ml-2 mb-1 flex min-h-11 w-fit items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/30"
      >
        <ArrowLeft size={16} /> Agregar
      </Link>
      <h1 className="text-3xl font-bold text-ink">Importar</h1>
      <p className="mb-4 text-sm text-lavender">Trae tus películas de Letterboxd o tu anime de MyAnimeList</p>

      <div className="flex flex-col gap-4 md:max-w-xl">
        {finished != null ? (
          <div className="flex flex-col items-center rounded-3xl bg-background-surface p-6 text-center ring-1 ring-primary-dark/40">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Check size={28} />
            </div>
            <p className="text-xl font-bold text-ink">
              {source === 'myanimelist'
                ? `${finished} anime importado${finished === 1 ? '' : 's'}`
                : plural(finished, 'película importada', 'películas importadas')}
            </p>
            <p className="mt-1 text-sm text-lavender">Ya están en Pantalla, con sus estados, puntajes y fechas.</p>
            <Link
              to={section.libraryPath}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-primary-darker"
            >
              <section.Icon size={18} /> Ver Pantalla
            </Link>
          </div>
        ) : (
          <>
            {!rows && !matching && <HowTo />}

            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".zip,.csv,.xml,.gz,application/zip,text/csv,text/xml,application/gzip"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            {!importing && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl font-semibold ${
                  rows || matching
                    ? 'text-accent ring-1 ring-primary-dark/50 active:bg-primary-dark/30'
                    : 'bg-accent text-primary-darker'
                }`}
              >
                <FileUp size={18} /> {rows || matching ? 'Elegir otro archivo' : 'Elegir el archivo'}
              </button>
            )}
            {fileError && <p className="rounded-xl bg-error/10 p-3 text-sm text-error">{fileError}</p>}

            {matching && (
              <div className="rounded-2xl bg-background-surface p-4 ring-1 ring-primary-dark/40">
                <p className="text-sm font-semibold text-ink">
                  {source === 'myanimelist' ? 'Buscando en AniList' : 'Buscando en TMDB'}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-dark/40">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${matching.total ? (matching.done / matching.total) * 100 : 100}%` }}
                  />
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-lavender">
                  <Loader2 size={12} className="animate-spin" /> {matching.done} de {matching.total}...
                </p>
              </div>
            )}

            {rows && plan && source && (
              <div className="rounded-2xl bg-background-surface p-4 ring-1 ring-primary-dark/40">
                <p className="text-xs font-semibold uppercase tracking-wide text-lavender">
                  Archivo de {SOURCE_NAMES[source]}
                </p>
                <p className="mt-1 text-2xl font-bold text-ink">
                  {source === 'myanimelist'
                    ? `${plan.toImport.length} anime ${plan.toImport.length === 1 ? 'nuevo' : 'nuevos'}`
                    : plural(plan.toImport.length, 'película nueva', 'películas nuevas')}
                </p>
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-lavender">
                  {plan.seen > 0 && <li>{labels.completed}: {plan.seen}</li>}
                  {plan.watching > 0 && <li>{labels.in_progress}: {plan.watching}</li>}
                  {plan.paused > 0 && <li>{labels.paused}: {plan.paused}</li>}
                  {plan.toWatch > 0 && <li>{labels.wishlist}: {plan.toWatch}</li>}
                  {plan.dropped > 0 && <li>{labels.dropped}: {plan.dropped}</li>}
                </ul>
                {skipped > 0 && (
                  <p className="mt-2 text-xs text-lavender">
                    {plural(skipped, 'ya estaba', 'ya estaban')} en Pantalla: se saltan.
                  </p>
                )}

                {plan.toImport.length > 0 && (
                  <div className="scrollbar-hide -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
                    {plan.toImport.slice(0, 12).map(({ entry, match }) => (
                      <div
                        key={entry.key}
                        className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-md bg-primary-dark/40 ring-1 ring-white/10"
                      >
                        <GameThumb
                          size="thumb"
                          src={match?.cover_url ?? null}
                          alt=""
                          className="h-full w-full object-cover"
                          icon={section.Icon}
                        />
                        {!match?.cover_url && (
                          <span className="absolute inset-x-1 bottom-1 line-clamp-3 text-center text-[8px] font-semibold leading-tight text-ink">
                            {entry.title}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {plan.unmatched.length > 0 && !importing && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-ink">
                      Sin coincidencia ({plan.unmatched.length})
                    </p>
                    <p className="mt-0.5 text-xs text-lavender">
                      No aparecen en {source === 'myanimelist' ? 'AniList' : 'TMDB'}. Marca los que quieras agregar
                      igual, sin portada ni datos (los completas después); el resto se salta.
                    </p>
                    <ul className="mt-2 flex max-h-72 flex-col overflow-y-auto">
                      {plan.unmatched.map(({ entry }) => {
                        const on = extra.has(entry.key)
                        return (
                          <li key={entry.key}>
                            <button
                              type="button"
                              onClick={() => toggleExtra(entry.key)}
                              aria-pressed={on}
                              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1 text-left text-sm active:bg-primary-dark/30"
                            >
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                                  on ? 'bg-accent text-primary-darker' : 'ring-1 ring-lavender/60'
                                }`}
                              >
                                {on && <Check size={14} />}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-ink">{entry.title}</span>
                              {entry.year && <span className="shrink-0 text-xs text-lavender">{entry.year}</span>}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {importing ? (
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-primary-dark/40">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${(done / plan.toImport.length) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-lavender">
                      <Loader2 size={12} className="animate-spin" /> Importando {done} de {plan.toImport.length}...
                    </p>
                  </div>
                ) : (
                  plan.toImport.length > 0 && (
                    <button
                      type="button"
                      onClick={handleImport}
                      className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-primary-darker"
                    >
                      Importar {plan.toImport.length} {plan.toImport.length === 1 ? noun : nouns}
                    </button>
                  )
                )}
              </div>
            )}

            <p className="text-xs text-lavender">
              El archivo se lee en tu teléfono y no se sube a ningún lado: solo se buscan los títulos (o los ids de
              MyAnimeList) para traer portadas, episodios y sinopsis.
            </p>
          </>
        )}
      </div>
    </PageContainer>
  )
}

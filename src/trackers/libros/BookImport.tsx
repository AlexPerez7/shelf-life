import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Check, FileUp, Loader2 } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { PageContainer } from '../../components/PageContainer'
import { GameThumb } from '../../components/GameThumb'
import { mediaSections } from '../../lib/media'
import {
  existingBookKeys,
  importedToItem,
  isDuplicate,
  parseBookExport,
  type ImportSource,
  type ImportedBook,
} from '../../lib/bookImport'
import { plural } from '../../lib/text'

const section = mediaSections.libros

const SOURCE_NAMES: Record<ImportSource, string> = { goodreads: 'Goodreads', storygraph: 'StoryGraph' }

/** Cómo exportar desde cada app (lo primero que se lee en la pantalla). */
function HowTo() {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-2xl bg-background-surface p-4 shadow-sm ring-1 ring-primary-dark/15">
        <p className="font-book font-semibold text-ink">Goodreads</p>
        <p className="mt-1 text-lavender">
          En la web: <span className="text-ink">My Books → Import and export → Export library</span>. Cuando esté
          listo, descarga el archivo <span className="text-ink">.csv</span>.
        </p>
      </div>
      <div className="rounded-2xl bg-background-surface p-4 shadow-sm ring-1 ring-primary-dark/15">
        <p className="font-book font-semibold text-ink">StoryGraph</p>
        <p className="mt-1 text-lavender">
          <span className="text-ink">Manage account → Export StoryGraph library</span>. Te llega un{' '}
          <span className="text-ink">.csv</span> para descargar.
        </p>
      </div>
    </div>
  )
}

/**
 * Importar el librero desde Goodreads o StoryGraph: se elige el CSV que
 * exportan, se ve un resumen (y qué ya está, que se salta) y se importa.
 * El archivo se lee en el teléfono; solo se guardan los libros.
 */
export function BookImport() {
  const { items, addItems } = useMedia()
  const { showError } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [parsed, setParsed] = useState<{ source: ImportSource; books: ImportedBook[] } | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(0)
  const [finished, setFinished] = useState<number | null>(null)

  const books = useMemo(() => items.filter((i) => i.media_type === 'book'), [items])
  // Se calcula una vez por archivo: mientras se importa, los nuevos no cuentan como "ya estaban".
  const [keys, setKeys] = useState<Set<string> | null>(null)

  const plan = useMemo(() => {
    if (!parsed || !keys) return null
    const toImport = parsed.books.filter((b) => !isDuplicate(b, keys))
    const count = (s: ImportedBook['status'][]) => toImport.filter((b) => s.includes(b.status)).length
    return {
      toImport,
      skipped: parsed.books.length - toImport.length,
      read: count(['completed']),
      reading: count(['in_progress', 'paused']),
      toRead: count(['wishlist', 'planned']),
      dropped: count(['dropped']),
    }
  }, [parsed, keys])

  async function handleFile(file: File | undefined) {
    if (!file) return
    setFileError(null)
    setFinished(null)
    try {
      const result = parseBookExport(await file.text())
      if (result.books.length === 0) throw new Error('El archivo no tiene libros.')
      setKeys(existingBookKeys(books))
      setParsed(result)
    } catch (err) {
      setParsed(null)
      setFileError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    }
  }

  async function handleImport() {
    if (!plan || plan.toImport.length === 0) return
    setImporting(true)
    setDone(0)
    try {
      const created = await addItems(plan.toImport.map(importedToItem), setDone)
      setFinished(created.length)
      setParsed(null)
    } catch (err) {
      showError(err, 'La importación se cortó; lo que alcanzó a entrar quedó en tu librero')
    } finally {
      setImporting(false)
    }
  }

  return (
    <PageContainer>
      <Link
        to={section.addPath}
        className="-ml-2 mb-1 flex min-h-11 w-fit items-center gap-1 rounded-full px-2 text-sm text-accent active:bg-primary-dark/15"
      >
        <ArrowLeft size={16} /> Agregar libro
      </Link>
      <h1 className="text-3xl font-bold text-ink">Importar libros</h1>
      <p className="mb-4 text-sm text-lavender">Trae tu biblioteca de Goodreads o StoryGraph</p>

      <div className="flex flex-col gap-4 md:max-w-xl">
        {finished != null ? (
          <div className="flex flex-col items-center rounded-3xl bg-background-surface p-6 text-center shadow-sm ring-1 ring-primary-dark/15">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Check size={28} />
            </div>
            <p className="font-book text-xl font-bold text-ink">
              {plural(finished, 'libro importado', 'libros importados')}
            </p>
            <p className="mt-1 text-sm text-lavender">Ya están en tu librero, con sus estados, puntajes y fechas.</p>
            <Link
              to={section.libraryPath}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white"
            >
              <BookOpen size={18} /> Ver mi librero
            </Link>
          </div>
        ) : (
          <>
            {!parsed && <HowTo />}

            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            {!importing && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl font-semibold ${
                  parsed ? 'text-accent ring-1 ring-primary-dark/30' : 'bg-primary text-white'
                }`}
              >
                <FileUp size={18} /> {parsed ? 'Elegir otro archivo' : 'Elegir el archivo .csv'}
              </button>
            )}
            {fileError && <p className="rounded-xl bg-error/10 p-3 text-sm text-error">{fileError}</p>}

            {parsed && plan && (
              <div className="rounded-2xl bg-background-surface p-4 shadow-sm ring-1 ring-primary-dark/15">
                <p className="text-xs font-semibold uppercase tracking-wide text-lavender">
                  Archivo de {SOURCE_NAMES[parsed.source]}
                </p>
                <p className="font-book mt-1 text-2xl font-bold text-ink">
                  {plural(plan.toImport.length, 'libro nuevo', 'libros nuevos')}
                </p>
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-lavender">
                  {plan.read > 0 && <li>{plan.read} leídos</li>}
                  {plan.reading > 0 && <li>{plan.reading} leyendo</li>}
                  {plan.toRead > 0 && <li>{plan.toRead} por leer</li>}
                  {plan.dropped > 0 && <li>{plan.dropped} abandonados</li>}
                </ul>
                {plan.skipped > 0 && (
                  <p className="mt-2 text-xs text-lavender">
                    {plural(plan.skipped, 'ya estaba', 'ya estaban')} en tu librero: se saltan.
                  </p>
                )}

                {plan.toImport.length > 0 && (
                  <div className="scrollbar-hide -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
                    {plan.toImport.slice(0, 12).map((b, i) => (
                      <div
                        key={`${b.title}-${i}`}
                        className="relative h-24 w-16 shrink-0 overflow-hidden rounded-[3px] bg-primary-dark/20 shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
                      >
                        <GameThumb
                          size="thumb"
                          src={importedToItem(b).cover_url ?? null}
                          alt=""
                          className="h-full w-full object-cover"
                          icon={BookOpen}
                        />
                        <span className="font-book absolute inset-x-1 bottom-1 line-clamp-3 text-center text-[8px] font-semibold leading-tight text-ink [text-shadow:0_0_3px_var(--color-background-surface)]">
                          {b.isbn ? '' : b.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {importing ? (
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-primary-dark/15">
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
                      className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-white"
                    >
                      Importar {plural(plan.toImport.length, 'libro')}
                    </button>
                  )
                )}
              </div>
            )}

            <p className="text-xs text-lavender">
              El archivo se lee en tu teléfono y no se sube a ningún lado: solo se guardan los libros. Las portadas
              salen de Open Library por ISBN; los géneros y sinopsis los puedes completar después.
            </p>
          </>
        )}
      </div>
    </PageContainer>
  )
}

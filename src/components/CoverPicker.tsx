import { useEffect, useRef, useState } from 'react'
import { Check, ImageOff, Link2 } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { GameThumb } from './GameThumb'
import { Skeleton } from './Skeleton'
import type { CoverOption } from '../lib/media'

const SOURCE_NAMES: Record<CoverOption['source'], string> = {
  openlibrary: 'Open Library',
  apple: 'Apple Books',
  google_books: 'Google Books',
  tmdb: 'TMDB',
  igdb: 'IGDB',
  steam: 'Steam',
}

interface CoverPickerProps {
  /** Portada actual (no se ofrece como opción). */
  currentUrl: string | null
  /** Busca las alternativas (`coverOptions` de media, `gameCoverOptions` de juegos). */
  load: () => Promise<CoverOption[]>
  open: boolean
  onClose: () => void
  onPick: (url: string) => void
  /** Ícono si una portada no carga. */
  icon: React.ComponentProps<typeof GameThumb>['icon']
}

/**
 * Elegir otra portada: las alternativas de las fuentes (ediciones, pósters
 * en otros idiomas) o una URL de imagen pegada a mano.
 */
export function CoverPicker({ currentUrl, load, open, onClose, onPick, icon }: CoverPickerProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Cambiar portada">
      {open && <CoverPickerBody currentUrl={currentUrl} load={load} onPick={onPick} icon={icon} />}
    </BottomSheet>
  )
}

function CoverPickerBody({ currentUrl, load, onPick, icon }: Omit<CoverPickerProps, 'open' | 'onClose'>) {
  const [options, setOptions] = useState<CoverOption[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [url, setUrl] = useState('')
  const [urlOk, setUrlOk] = useState<boolean | null>(null)

  // La hoja se cierra al elegir: una búsqueda por apertura (el cuerpo se
  // monta al abrir), con lo que había al abrirla.
  const initial = useRef({ load, currentUrl })
  useEffect(() => {
    let cancelled = false
    initial.current
      .load()
      .then((o) => !cancelled && setOptions(o.filter((c) => c.url !== initial.current.currentUrl)))
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        setOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const trimmed = url.trim()
  const validUrl = /^https:\/\/\S+$/i.test(trimmed)

  return (
    <div>
      {options == null ? (
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full" />
          ))}
        </div>
      ) : options.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl bg-background/40 p-3 text-sm text-lavender">
          <ImageOff size={16} className="shrink-0" />
          {failed ? 'No se pudieron buscar portadas.' : 'No encontramos otras portadas.'} Puedes pegar la URL de una
          imagen abajo.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-lavender">
            {options.length} opciones · toca la que quieras
          </p>
          <div className="grid max-h-[50vh] grid-cols-3 gap-x-3 gap-y-4 overflow-y-auto pb-1 sm:grid-cols-4">
            {options.map((c) => (
              <button
                key={c.url}
                type="button"
                onClick={() => onPick(c.url)}
                className="text-left transition-transform active:scale-95"
              >
                <div className="aspect-[2/3] w-full overflow-hidden rounded-md bg-primary-dark/20 ring-1 ring-primary-dark/30">
                  <GameThumb size="poster" src={c.url} alt="" className="h-full w-full object-cover" icon={icon} />
                </div>
                <p className="mt-1 truncate text-[10px] text-lavender">{c.label ?? SOURCE_NAMES[c.source]}</p>
              </button>
            ))}
          </div>
        </>
      )}

      <form
        className="mt-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (validUrl && urlOk) onPick(trimmed)
        }}
      >
        <label className="mb-1 flex items-center gap-1.5 text-xs text-lavender">
          <Link2 size={13} /> O pega la URL de una imagen
        </label>
        <div className="flex gap-2">
          {validUrl && (
            <div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-primary-dark/20">
              <img
                key={trimmed}
                src={trimmed}
                alt=""
                className="h-full w-full object-cover"
                onLoad={() => setUrlOk(true)}
                onError={() => setUrlOk(false)}
              />
            </div>
          )}
          <input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setUrlOk(null)
            }}
            placeholder="https://..."
            className="min-w-0 flex-1 rounded-xl bg-background/40 px-3 py-2.5 text-sm text-ink ring-1 ring-primary-dark/30 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={!validUrl || !urlOk}
            className="flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-accent px-3 text-sm font-semibold text-background disabled:opacity-40"
          >
            <Check size={15} /> Usar
          </button>
        </div>
        {validUrl && urlOk === false && (
          <p className="mt-1 text-xs text-error">Esa URL no es una imagen que se pueda mostrar.</p>
        )}
      </form>
    </div>
  )
}

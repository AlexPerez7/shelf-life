import { useMemo, useState } from 'react'
import { ImageOff, Loader2, Search } from 'lucide-react'
import { useMedia } from '../../contexts/MediaContext'
import { useToast } from '../../contexts/ToastContext'
import { haptic } from '../../lib/haptics'
import { plural } from '../../lib/text'
import {
  checkedCover,
  coverCandidates,
  eachLimited,
  FIND_COVERS_BATCH,
  findBookCovers,
  imageLoads,
} from '../../lib/bookCovers'
import type { Item } from '../../types/item'

/**
 * "Completar portadas": comprueba las portadas puestas al importar (pueden
 * no existir) y busca una para los libros que no tienen. Solo aparece si hay
 * algo para revisar.
 */
export function MissingCovers({ books }: { books: Item[] }) {
  const { updateItem } = useMedia()
  const { showToast, showError } = useToast()
  const { missing, unchecked } = useMemo(() => coverCandidates(books), [books])
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null)

  if (missing.length === 0 && unchecked.length === 0 && !progress) return null

  async function run() {
    haptic()
    try {
      // 1. Las portadas de la importación: las que cargan quedan comprobadas.
      const without = [...missing]
      let done = 0
      setProgress({ label: 'Revisando portadas', done, total: unchecked.length })
      await eachLimited(unchecked, 6, async (b) => {
        const ok = await imageLoads(b.cover_url!)
        if (ok) await updateItem(b.id, { cover_url: checkedCover(b.cover_url!) })
        else without.push(b)
        setProgress({ label: 'Revisando portadas', done: ++done, total: unchecked.length })
      })

      // 2. Buscar una portada para las que faltan, en tandas.
      let found = 0
      done = 0
      setProgress({ label: 'Buscando portadas', done, total: without.length })
      for (let i = 0; i < without.length; i += FIND_COVERS_BATCH) {
        const batch = without.slice(i, i + FIND_COVERS_BATCH)
        const covers = await findBookCovers(batch)
        await eachLimited(
          batch.map((b, j) => [b, covers[j]] as const),
          4,
          async ([b, url]) => {
            // Sin portada: se deja vacía (así no se vuelve a comprobar la de la importación).
            if (url) found++
            if (url || b.cover_url) await updateItem(b.id, { cover_url: url })
          }
        )
        done += batch.length
        setProgress({ label: 'Buscando portadas', done, total: without.length })
      }
      showToast(
        without.length === 0
          ? 'Todas las portadas estaban bien'
          : `Encontramos ${found} de ${plural(without.length, 'portada que faltaba', 'portadas que faltaban')}`
      )
    } catch (err) {
      showError(err, 'No se pudieron completar las portadas')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-background-surface p-3.5 shadow-sm ring-1 ring-primary-dark/15 md:max-w-xl">
      <ImageOff size={20} className="shrink-0 text-accent" />
      {progress ? (
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-lavender">
          <Loader2 size={14} className="shrink-0 animate-spin" /> {progress.label}: {progress.done} de {progress.total}
        </p>
      ) : (
        <>
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-book block font-semibold text-ink">
              {missing.length > 0
                ? `${plural(missing.length, 'libro', 'libros')} sin portada`
                : 'Portadas importadas sin revisar'}
            </span>
            <span className="text-lavender">Buscamos las que faltan en Open Library y otras fuentes</span>
          </p>
          <button
            type="button"
            onClick={run}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-white"
          >
            <Search size={15} /> Buscar
          </button>
        </>
      )}
    </div>
  )
}

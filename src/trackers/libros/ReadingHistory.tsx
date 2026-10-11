import { useState } from 'react'
import { History, Plus, Trash2 } from 'lucide-react'
import { SectionCard } from '../../components/SectionCard'
import { formatDate } from '../../lib/dates'
import { haptic } from '../../lib/haptics'
import { plural } from '../../lib/text'
import {
  addReadingChanges,
  editReadingChanges,
  pastReadings,
  readingDays,
  removeReadingChanges,
  timesRead,
  type Reading,
} from '../../lib/readings'
import type { Item, ItemWrite } from '../../types/item'

const inputClass =
  'w-full min-w-0 rounded-lg bg-background/60 px-2 py-2 text-sm text-ink ring-1 ring-primary-dark/20 focus:outline-none focus:ring-2 focus:ring-accent'

interface ReadingHistoryProps {
  item: Item
  onSave: (changes: ItemWrite, message?: string) => void
}

/** "Leído 3 veces": las lecturas anteriores, con sus fechas, editables. */
export function ReadingHistory({ item, onSave }: ReadingHistoryProps) {
  const readings = pastReadings(item)
  const total = timesRead(item)
  // Relecturas importadas (Goodreads, StoryGraph) sin fechas.
  const undated = Math.max(0, item.replays - readings.length)
  const [adding, setAdding] = useState<Reading | null>(null)

  if (readings.length === 0 && undated === 0 && total === 0 && !adding) {
    return (
      <AddButton onClick={() => setAdding({ started: null, finished: null })} label="¿Ya lo habías leído antes? Agrega esa lectura" />
    )
  }

  return (
    <SectionCard icon={History} title={total > 0 ? `Leído ${total === 1 ? 'una vez' : `${total} veces`}` : 'Lecturas'}>
      <ul className="flex flex-col gap-3">
        {readings.map((r, i) => {
          const days = readingDays(r)
          return (
            <li key={`${r.started}-${r.finished}-${i}`}>
              <div className="mb-1 flex items-center justify-between text-xs text-lavender">
                <span>
                  Lectura {i + 1}
                  {r.finished ? ` · terminada el ${formatDate(r.finished)}` : ''}
                  {days ? ` · ${plural(days, 'día')}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    haptic()
                    onSave(removeReadingChanges(item, i), 'Lectura borrada')
                  }}
                  aria-label={`Borrar la lectura ${i + 1}`}
                  className="-my-2 flex h-11 w-11 items-center justify-center rounded-full text-lavender active:bg-error/10 active:text-error"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <DateRange value={r} onChange={(next) => onSave(editReadingChanges(item, i, next))} />
            </li>
          )
        })}
      </ul>
      {undated > 0 && (
        <p className={`text-xs text-lavender ${readings.length ? 'mt-3' : ''}`}>
          {plural(undated, 'lectura anterior', 'lecturas anteriores')} sin fechas (importadas).
        </p>
      )}
      <p className="mt-3 text-xs text-lavender">
        La lectura actual son las fechas de "Mi registro". Al tocar "Releer", la que terminaste pasa a esta lista.
      </p>

      {adding ? (
        <div className="mt-3 rounded-xl bg-background/40 p-3 ring-1 ring-primary-dark/15">
          <p className="mb-2 text-xs font-semibold text-ink">Lectura anterior</p>
          <DateRange value={adding} onChange={setAdding} />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(null)}
              className="min-h-11 rounded-xl px-3 text-sm text-lavender active:bg-primary-dark/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!adding.started && !adding.finished}
              onClick={() => {
                haptic()
                onSave(addReadingChanges(item, adding), 'Lectura agregada')
                setAdding(null)
              }}
              className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              Agregar
            </button>
          </div>
        </div>
      ) : (
        <AddButton onClick={() => setAdding({ started: null, finished: null })} label="Agregar una lectura anterior" />
      )}
    </SectionCard>
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-accent ring-1 ring-primary-dark/25 active:bg-primary-dark/10"
    >
      <Plus size={15} /> {label}
    </button>
  )
}

function DateRange({ value, onChange }: { value: Reading; onChange: (next: Reading) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block">
        <span className="mb-0.5 block text-[11px] text-lavender">Empecé</span>
        <input
          type="date"
          value={value.started ?? ''}
          max={value.finished ?? undefined}
          onChange={(e) => onChange({ ...value, started: e.target.value || null })}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-0.5 block text-[11px] text-lavender">Terminé</span>
        <input
          type="date"
          value={value.finished ?? ''}
          min={value.started ?? undefined}
          onChange={(e) => onChange({ ...value, finished: e.target.value || null })}
          className={inputClass}
        />
      </label>
    </div>
  )
}

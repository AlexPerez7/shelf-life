import { useState } from 'react'
import { Calendar, ChevronDown, Disc, Gamepad2, Layers, Minus, Pencil, Plus, Repeat, SlidersHorizontal, Tag } from 'lucide-react'
import { SectionCard } from '../../../components/SectionCard'
import { PlatformPicker } from '../../../components/PlatformPicker'
import { FormatPicker } from '../../../components/FormatPicker'
import { TagList } from '../../../components/TagList'
import { unixToYear, yearToUnix } from '../../../lib/dates'
import type { Game } from '../../../types/game'
import { inputClass } from './shared'

const MORE_DETAILS_KEY = 'shelflife_detail_more_open'

function readMoreDetailsPref() {
  try {
    return localStorage.getItem(MORE_DETAILS_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Título, portada y año: sobre todo para juegos cargados a mano. Se guardan al
 * salir de cada campo (un título vacío o un año inválido no se guardan).
 */
function GameDataCard({ game, onSave }: { game: Game; onSave: (changes: Partial<Game>) => void }) {
  const [title, setTitle] = useState(game.title)
  const [cover, setCover] = useState(game.cover_url ?? '')
  const [year, setYear] = useState(unixToYear(game.first_release_date))

  return (
    <SectionCard icon={Pencil} title="Datos del juego">
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-lavender">Título</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const next = title.trim()
              if (!next) setTitle(game.title)
              else if (next !== game.title) onSave({ title: next })
            }}
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-[1fr_5.5rem] gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-lavender">Portada (URL)</span>
            <input
              type="url"
              inputMode="url"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              onBlur={() => {
                const next = cover.trim() || null
                if (next !== game.cover_url) onSave({ cover_url: next })
              }}
              placeholder="https://..."
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-lavender">Año</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              onBlur={() => {
                const trimmed = year.trim()
                if (trimmed === unixToYear(game.first_release_date)) return
                if (!trimmed) onSave({ first_release_date: null })
                else if (yearToUnix(trimmed) != null) onSave({ first_release_date: yearToUnix(trimmed) })
                else setYear(unixToYear(game.first_release_date))
              }}
              placeholder="2024"
              className={inputClass}
            />
          </label>
        </div>
      </div>
    </SectionCard>
  )
}

interface MoreDetailsProps {
  game: Game
  setField: (changes: Partial<Game>, options?: { immediate?: boolean }) => void
}

/**
 * "Más detalles": datos del juego, plataforma, fechas, formato, etiquetas,
 * franquicia y replays. Plegado (se recuerda abierto o cerrado).
 */
export function MoreDetails({ game, setField }: MoreDetailsProps) {
  const [open, setOpen] = useState(readMoreDetailsPref)

  function toggle() {
    setOpen((open) => {
      try {
        localStorage.setItem(MORE_DETAILS_KEY, String(!open))
      } catch {
        /* preferencia no persistida: no pasa nada */
      }
      return !open
    })
  }

  return (
    <>
      {/* Campos que se tocan poco: agrupados y plegados para que la
          pantalla no sea un scroll interminable en el teléfono. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex min-h-12 items-center justify-between rounded-2xl bg-background-surface px-4 text-sm font-semibold text-ink ring-1 ring-primary-dark/20"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-lavender" />
          Más detalles
          <span className="font-normal text-lavender">
            · datos, plataforma, fechas…
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`text-lavender transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <>
          <GameDataCard
            // Si la portada cambia desde "Cambiar portada", el campo se rearma con la nueva.
            key={game.cover_url ?? ''}
            game={game}
            onSave={(changes) => setField(changes, { immediate: true })}
          />

          <SectionCard icon={Gamepad2} title="Plataforma">
            <PlatformPicker
              value={game.platform}
              onChange={(platform) => setField({ platform })}
            />
          </SectionCard>

          <SectionCard icon={Calendar} title="Fechas">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-lavender">Inicio</span>
                <input
                  type="date"
                  value={game.date_started ?? ''}
                  onChange={(e) => setField({ date_started: e.target.value || null })}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-lavender">Fin</span>
                <input
                  type="date"
                  value={game.date_finished ?? ''}
                  onChange={(e) => setField({ date_finished: e.target.value || null })}
                  className={inputClass}
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard icon={Disc} title="Formato">
            <FormatPicker
              value={game.format}
              onChange={(format) => setField({ format })}
            />
          </SectionCard>

          <SectionCard icon={Tag} title="Etiquetas">
            <div className="mb-2">
              <TagList value={game.genre} />
            </div>
            <input
              value={game.genre ?? ''}
              onChange={(e) => setField({ genre: e.target.value })}
              placeholder="Separa varios con coma"
              aria-label="Etiquetas"
              className={inputClass}
            />
          </SectionCard>

          <SectionCard icon={Layers} title="Franquicia">
            <input
              value={game.franchise ?? ''}
              onChange={(e) => setField({ franchise: e.target.value })}
              placeholder="Ej. Final Fantasy"
              aria-label="Franquicia"
              className={inputClass}
            />
          </SectionCard>

          <SectionCard icon={Repeat} title="Replays">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setField({ replays: Math.max(0, (game.replays ?? 0) - 1) })
                }
                aria-label="Restar un replay"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-dark/20 text-lavender"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center text-lg font-semibold text-ink" aria-live="polite">
                {game.replays ?? 0}
              </span>
              <button
                type="button"
                onClick={() => setField({ replays: (game.replays ?? 0) + 1 })}
                aria-label="Sumar un replay"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-dark/20 text-lavender"
              >
                <Plus size={16} />
              </button>
            </div>
          </SectionCard>
    </>
    )}
    </>
  )
}

import { COMMON_FORMATS } from '../lib/formats'
import { parseTags } from '../lib/tags'
import { Chip } from './Chip'

interface FormatPickerProps {
  value: string | null | undefined
  onChange: (value: string) => void
  /** Opciones (por defecto, las de juegos). */
  options?: string[]
  /** Fondo de los chips sin marcar (ej. sobre una tarjeta). */
  inactiveClassName?: string
}

/** Formatos como chips; se pueden marcar varios (se guardan separados por coma). */
export function FormatPicker({ value, onChange, options = COMMON_FORMATS, inactiveClassName }: FormatPickerProps) {
  const selected = parseTags(value)

  function toggle(format: string) {
    const next = selected.includes(format)
      ? selected.filter((f) => f !== format)
      : [...selected, format]
    onChange(next.join(', '))
  }

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-3">
      {options.map((format) => (
        <Chip
          key={format}
          active={selected.includes(format)}
          onClick={() => toggle(format)}
          inactiveClassName={inactiveClassName}
        >
          {format}
        </Chip>
      ))}
    </div>
  )
}

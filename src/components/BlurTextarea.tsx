import { useEffect, useState } from 'react'

interface BlurTextareaProps {
  value: string | null
  onSave: (value: string | null) => void
  rows: number
  placeholder: string
  className?: string
}

/** Campo de texto que guarda al salir del campo (no en cada tecla). */
export function BlurTextarea({ value, onSave, rows, placeholder, className = '' }: BlurTextareaProps) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => setText(value ?? ''), [value])
  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const next = text.trim() || null
        if (next !== (value ?? null)) onSave(next)
      }}
      rows={rows}
      placeholder={placeholder}
      className={className}
    />
  )
}

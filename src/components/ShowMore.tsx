/** Botón "Mostrar más" al final de una lista por tandas (no se ve si no queda nada). Ver `hooks/useBatch.ts`. */
export function ShowMore({ remaining, onClick }: { remaining: number; onClick: () => void }) {
  if (remaining <= 0) return null
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto mt-4 flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-accent active:bg-primary-dark/15"
    >
      Mostrar más ({remaining})
    </button>
  )
}

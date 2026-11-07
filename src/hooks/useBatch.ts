import { useCallback, useState } from 'react'

/** Elementos por tanda en las cuadrículas largas: cientos de portadas a la vez traban el teléfono. */
export const BATCH = 60

/** Cuántos elementos se muestran y cómo pedir otra tanda (con `components/ShowMore.tsx`). */
export function useBatch(size = BATCH) {
  const [limit, setLimit] = useState(size)
  const more = useCallback(() => setLimit((n) => n + size), [size])
  return { limit, more }
}

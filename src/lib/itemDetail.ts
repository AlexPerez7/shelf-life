// Carga en dos tiempos de `items`: las listas piden solo lo que necesitan
// para dibujarse y el detalle completa la sinopsis, las notas y la reseña (lo
// más pesado) al abrirse. Con miles de títulos, la lista pesa mucho menos
// (red, memoria y cache local).

import type { Item, ItemWrite } from '../types/item'

/** Columnas de la lista: todas las de `items` menos las de texto largo. */
export const LIST_COLUMNS =
  'id,user_id,media_type,title,status,rating,cover_url,genres,release_date,date_started,date_finished,' +
  'time_spent_minutes,progress,progress_total,source,external_id,metadata,is_favorite,format,replays,' +
  'franchise,created_at,updated_at'

/** Lo que completa el detalle. */
export const DETAIL_COLUMNS = ['summary', 'review', 'notes'] as const
export const DETAIL_SELECT = `id,${DETAIL_COLUMNS.join(',')}`

type DetailFields = Pick<Item, (typeof DETAIL_COLUMNS)[number]>

/** ¿El ítem ya trae sinopsis, notas y reseña? (Los de la lista no las traen: ni siquiera existe la clave.) */
export const hasDetail = (item: Item) => DETAIL_COLUMNS.every((c) => c in item)

function pickDetail(item: Item): Partial<DetailFields> {
  return Object.fromEntries(DETAIL_COLUMNS.filter((c) => c in item).map((c) => [c, item[c]]))
}

/**
 * Los ítems recién traídos de la base (sin el detalle), conservando el que ya
 * se había cargado: así volver a pedir la lista no obliga a abrir de nuevo cada ficha.
 */
export function keepDetail(fetched: Item[], previous: Item[]): Item[] {
  if (previous.length === 0) return fetched
  const byId = new Map(previous.filter(hasDetail).map((i) => [i.id, i]))
  return fetched.map((i) => {
    const before = byId.get(i.id)
    return before && !hasDetail(i) ? { ...i, ...pickDetail(before) } : i
  })
}

/** El ítem con el detalle que acaba de llegar, y encima lo que se cambió sin conexión (`pending`). */
export function withDetail(item: Item, detail: DetailFields, pending: ItemWrite = {}): Item {
  const overrides = Object.fromEntries(DETAIL_COLUMNS.filter((c) => c in pending).map((c) => [c, pending[c]]))
  return { ...item, ...detail, ...overrides }
}

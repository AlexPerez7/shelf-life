// Exportar los datos del usuario: un respaldo completo en JSON (biblioteca,
// actividad, listas y metas) o la biblioteca en CSV para una planilla.

import { ensureSession, supabase } from './supabaseClient'
import { todayISO } from './dates'
import type { Item } from '../types/item'

const PAGE = 1000

/** Todas las filas de una tabla (Supabase devuelve como máximo 1000 por pedido). */
async function fetchAll(table: string, order: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(order, { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

/** Respaldo completo, como JSON legible. */
export async function exportJson(): Promise<Blob> {
  await ensureSession()
  const [items, activity, lists, listItems] = await Promise.all([
    fetchAll('items', 'created_at'),
    fetchAll('activity_log', 'occurred_at'),
    fetchAll('lists', 'created_at'),
    fetchAll('list_items', 'added_at'),
  ])
  // Las metas pueden no existir (migración 0012 sin aplicar).
  const goals = await fetchAll('goals', 'year').catch(() => [])
  const data = {
    app: 'Shelf Life',
    version: 1,
    exported_at: new Date().toISOString(),
    items,
    activity_log: activity,
    lists,
    list_items: listItems,
    goals,
  }
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

const CSV_COLUMNS: [string, (i: Item) => unknown][] = [
  ['tipo', (i) => i.media_type],
  ['titulo', (i) => i.title],
  ['autores', (i) => i.metadata.authors?.join('; ')],
  ['estado', (i) => i.status],
  ['puntaje (1-10)', (i) => i.rating],
  ['favorito', (i) => (i.is_favorite ? 'sí' : '')],
  ['avance', (i) => i.progress],
  ['total', (i) => i.progress_total],
  ['minutos', (i) => i.time_spent_minutes],
  ['formato', (i) => i.format],
  ['generos', (i) => i.genres.join('; ')],
  ['fecha de estreno', (i) => i.release_date],
  ['empezado', (i) => i.date_started],
  ['terminado', (i) => i.date_finished],
  ['repeticiones', (i) => i.replays],
  ['isbn', (i) => i.metadata.isbn],
  ['notas', (i) => i.notes],
  ['reseña', (i) => i.review],
  ['agregado', (i) => i.created_at.slice(0, 10)],
]

function csvCell(value: unknown) {
  if (value == null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** La biblioteca (los tres trackers) en CSV, con BOM para que Excel lea los acentos. */
export async function exportCsv(): Promise<Blob> {
  await ensureSession()
  const items = (await fetchAll('items', 'created_at')) as unknown as Item[]
  const lines = [
    CSV_COLUMNS.map(([name]) => csvCell(name)).join(','),
    ...items.map((item) => CSV_COLUMNS.map(([, get]) => csvCell(get(item))).join(',')),
  ]
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

/**
 * Entrega el archivo: en el teléfono, con el menú de compartir (guardar en
 * Archivos, Drive, mandarlo...); si no se puede, como descarga.
 */
export async function deliverFile(blob: Blob, kind: 'json' | 'csv') {
  const name = `shelf-life-${todayISO()}.${kind}`
  const file = new File([blob], name, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return
    } catch (err) {
      // Cerrar el menú no es un error; cualquier otra cosa, se descarga.
      if (err instanceof DOMException && err.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Subir una foto propia como portada (bucket `covers`, migración 0013).
// La foto se achica en el teléfono antes de subirla: una portada se ve a lo
// sumo a ~300 px de ancho, y una foto de cámara pesa varios MB.

import { supabase } from './supabaseClient'

/** Ancho máximo de la portada subida (el doble de lo que se muestra, para pantallas densas). */
export const COVER_MAX_WIDTH = 600
const COVER_MAX_HEIGHT = 900

/** Tamaño final manteniendo la proporción, sin agrandar. */
export function fitCover(width: number, height: number, maxW = COVER_MAX_WIDTH, maxH = COVER_MAX_HEIGHT) {
  const scale = Math.min(1, maxW / width, maxH / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Ruta dentro del bucket: la carpeta es el usuario (lo exige la política de Storage). */
export const coverPath = (userId: string, itemId: string, now = Date.now()) => `${userId}/${itemId}-${now}.jpg`

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitCover(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85)
  )
}

/** Achica la foto, la sube y devuelve su URL pública. */
export async function uploadCover(itemId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Elige una imagen')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa')

  const blob = await shrink(file)
  const path = coverPath(user.id, itemId)
  const { error } = await supabase.storage.from('covers').upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  })
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error('Subir fotos todavía no está activado: falta aplicar la migración 0013 en Supabase.')
    }
    throw error
  }
  return supabase.storage.from('covers').getPublicUrl(path).data.publicUrl
}

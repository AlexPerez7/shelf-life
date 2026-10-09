import { supabase } from './supabaseClient'

/** Invoca una Edge Function y extrae el mensaje de error real del cuerpo. */
export async function callFn<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (!error) return data as T

  let message = error.message
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const parsed = await ctx.json()
      if (parsed?.error) message = parsed.error
    } catch {
      /* el cuerpo no era JSON, dejamos el mensaje genérico */
    }
  }
  throw new Error(message)
}

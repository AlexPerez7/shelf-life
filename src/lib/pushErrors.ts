/** ¿El error es que falta la tabla (migración 0016 sin aplicar)? */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205' || /push_subscriptions/i.test(error.message ?? '')
}

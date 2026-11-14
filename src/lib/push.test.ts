import { describe, expect, it } from 'vitest'
import { urlBase64ToBytes } from './push'
import { isMissingTable } from './pushErrors'

describe('clave VAPID', () => {
  it('pasa de base64 "url safe" (con - y _, sin relleno) a bytes', () => {
    // 65 bytes de una clave pública, con los caracteres "-" y "_" que usa el formato.
    expect([...urlBase64ToBytes('AQID')]).toEqual([1, 2, 3])
    expect([...urlBase64ToBytes('-_8')]).toEqual([251, 255])
    expect(urlBase64ToBytes('').length).toBe(0)
  })
})

describe('migración sin aplicar', () => {
  it('reconoce que falta la tabla', () => {
    expect(isMissingTable({ code: '42P01' })).toBe(true)
    expect(isMissingTable({ code: 'PGRST205', message: "Could not find the table 'public.push_subscriptions'" })).toBe(true)
    expect(isMissingTable({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isMissingTable(null)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { gunzip, isGzip, isZip, readZipTexts } from './zip'

async function compress(text: string, format: 'deflate-raw' | 'gzip') {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Arma un zip mínimo (sin CRC: el lector no lo revisa). */
async function makeZip(files: { name: string; text: string; deflate: boolean }[]) {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const data = f.deflate ? await compress(f.text, 'deflate-raw') : enc.encode(f.text)
    const local = new Uint8Array(30 + name.length + data.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, f.deflate ? 8 : 0, true)
    lv.setUint32(18, data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)

    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, f.deflate ? 8 : 0, true)
    cv.setUint32(20, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    central.set(name, 46)

    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((s, c) => s + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const out = new Uint8Array(offset + centralSize + 22)
  let pos = 0
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, pos)
    pos += part.length
  }
  return out
}

describe('readZipTexts', () => {
  it('lee archivos guardados y comprimidos, y solo los pedidos', async () => {
    const zip = await makeZip([
      { name: 'watched.csv', text: 'Date,Name\n2024-01-01,Alien', deflate: true },
      { name: 'deleted/', text: '', deflate: false },
      { name: 'profile.csv', text: 'Username\nyo', deflate: false },
      { name: 'diary.csv', text: 'Ñandú', deflate: false },
    ])
    expect(isZip(zip)).toBe(true)
    const files = await readZipTexts(zip, (n) => n !== 'profile.csv')
    expect([...files.keys()]).toEqual(['watched.csv', 'diary.csv'])
    expect(files.get('watched.csv')).toBe('Date,Name\n2024-01-01,Alien')
    expect(files.get('diary.csv')).toBe('Ñandú')
  })

  it('rechaza un archivo que no es zip', async () => {
    await expect(readZipTexts(new TextEncoder().encode('hola, no soy un zip'))).rejects.toThrow('dañado')
  })
})

describe('gunzip', () => {
  it('descomprime un .gz', async () => {
    const gz = await compress('<myanimelist></myanimelist>', 'gzip')
    expect(isGzip(gz)).toBe(true)
    expect(new TextDecoder().decode(await gunzip(gz))).toBe('<myanimelist></myanimelist>')
  })
})

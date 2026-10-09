// Lectura mínima de archivos .zip y .gz en el navegador, sin dependencias:
// el índice del zip se lee a mano y cada archivo se descomprime con
// `DecompressionStream` (Chrome 80+, Safari 16.4+, Firefox 113+).

async function inflate(data: Uint8Array, format: 'deflate-raw' | 'gzip'): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** ¿Empieza con la firma de un zip ("PK\x03\x04")? */
export function isZip(bytes: Uint8Array) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

/** ¿Empieza con la firma de gzip (1f 8b)? */
export function isGzip(bytes: Uint8Array) {
  return bytes[0] === 0x1f && bytes[1] === 0x8b
}

export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return inflate(bytes, 'gzip')
}

/**
 * Archivos de texto de un zip, por nombre (con su carpeta, ej.
 * "deleted/watched.csv"). Solo lee los que pasan `wanted`, para no
 * descomprimir de más. Soporta "stored" y "deflate", que es lo que usan
 * todos los exports.
 */
export async function readZipTexts(
  bytes: Uint8Array,
  wanted: (name: string) => boolean = () => true
): Promise<Map<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // Fin del directorio central: está al final, antes de un comentario opcional.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('El .zip está dañado o incompleto.')

  const count = view.getUint16(eocd + 10, true)
  let pos = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()
  const out = new Map<string, string>()

  for (let n = 0; n < count; n++) {
    if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('El .zip está dañado o incompleto.')
    const method = view.getUint16(pos + 10, true)
    const compressedSize = view.getUint32(pos + 20, true)
    const nameLength = view.getUint16(pos + 28, true)
    const extraLength = view.getUint16(pos + 30, true)
    const commentLength = view.getUint16(pos + 32, true)
    const localOffset = view.getUint32(pos + 42, true)
    const name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength))
    pos += 46 + nameLength + extraLength + commentLength

    if (name.endsWith('/') || !wanted(name)) continue
    // El encabezado local puede tener otro largo de "extra" que el central.
    const dataStart =
      localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
    const data = bytes.subarray(dataStart, dataStart + compressedSize)
    if (method === 0) out.set(name, decoder.decode(data))
    else if (method === 8) out.set(name, decoder.decode(await inflate(data, 'deflate-raw')))
  }
  return out
}

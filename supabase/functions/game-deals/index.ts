// Edge Function: precios de juegos en tiendas de PC vía CheapShark.
// CheapShark no requiere API key, pero limita por IP y los Edge Functions de
// Supabase comparten IP entre muchos proyectos -> sin cache casi todas las
// llamadas devuelven 429. Por eso guardamos los resultados en la tabla
// `price_cache` (ver migración 0005) con un TTL de 12 h.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handlePreflight, jsonResponse, errorResponse } from '../_shared/http.ts'
import { requireUser } from '../_shared/supabase.ts'

const CACHE_TTL_MS = 12 * 60 * 60 * 1000

const STORE_NAMES: Record<string, string> = {
  '1': 'Steam',
  '2': 'GamersGate',
  '3': 'GreenManGaming',
  '7': 'GOG',
  '8': 'Origin',
  '11': 'Humble Store',
  '13': 'Uplay',
  '15': 'Fanatical',
  '21': 'WinGameStore',
  '23': 'GameBillet',
  '25': 'Epic Games Store',
  '27': 'Gamesplanet',
  '30': 'IndieGala',
}

interface CheapSharkDeal {
  dealID: string
  storeID: string
  salePrice: string
  normalPrice: string
  savings: string
}

interface Deal {
  store: string
  salePrice: number
  normalPrice: number
  savingsPercent: number
  url: string
}

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchDeals(title: string, steamAppId?: number): Promise<Deal[]> {
  const params = new URLSearchParams({ limit: '20', sortBy: 'Price' })
  if (steamAppId) {
    params.set('steamAppID', String(steamAppId))
  } else {
    params.set('title', title)
  }

  // Un reintento con backoff: el 429 de CheapShark suele ser transitorio.
  let res: Response | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(`https://www.cheapshark.com/api/1.0/deals?${params}`, {
      headers: { 'User-Agent': 'ShelfLife/1.0 (+https://alexperez7.github.io/shelf-life/)' },
    })
    if (res.status !== 429) break
    await sleep(800)
  }
  if (!res || !res.ok) {
    throw new Error(`Error de CheapShark (${res?.status ?? 'sin respuesta'})`)
  }

  const raw: CheapSharkDeal[] = await res.json()

  // Un resultado por tienda (el más barato); la API a veces repite juego+tienda.
  const seen = new Set<string>()
  const deals: Deal[] = []
  for (const d of raw) {
    if (seen.has(d.storeID)) continue
    seen.add(d.storeID)
    deals.push({
      store: STORE_NAMES[d.storeID] ?? `Tienda ${d.storeID}`,
      salePrice: parseFloat(d.salePrice),
      normalPrice: parseFloat(d.normalPrice),
      savingsPercent: Math.round(parseFloat(d.savings)),
      url: `https://www.cheapshark.com/redirect?dealID=${d.dealID}`,
    })
    if (deals.length >= 5) break
  }
  return deals
}

serve(async (req) => {
  const preflight = handlePreflight(req)
  if (preflight) return preflight

  try {
    // Solo usuarios logueados: la función escribe en price_cache con service
    // role, así que abierta a cualquiera serviría para llenar la cache con
    // basura y agotar el rate limit de CheapShark.
    const auth = await requireUser(req)
    if (auth instanceof Response) return auth

    const body = await req.json().catch(() => ({}))
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : ''
    if (!title) {
      return jsonResponse({ error: 'Falta el parámetro title' }, 400)
    }
    const appId = Number(body.steamAppId)
    const steamAppId = Number.isInteger(appId) && appId > 0 ? appId : undefined

    const cacheKey = steamAppId
      ? `steam:${steamAppId}`
      : `title:${title.toLowerCase().trim()}`

    const { data: cached } = await admin
      .from('price_cache')
      .select('deals, fetched_at')
      .eq('cache_key', cacheKey)
      .maybeSingle()

    const fresh =
      cached && Date.now() - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS
    if (fresh) {
      return jsonResponse(cached.deals as Deal[])
    }

    let deals: Deal[]
    try {
      deals = await fetchDeals(title, steamAppId)
    } catch (err) {
      // CheapShark caído o rate-limitado: devolvemos la cache vieja si existe,
      // si no una lista vacía (el frontend simplemente no muestra la sección).
      if (cached) return jsonResponse(cached.deals as Deal[])
      console.error('game-deals fallback vacío:', err)
      return jsonResponse([])
    }

    await admin
      .from('price_cache')
      .upsert({ cache_key: cacheKey, deals, fetched_at: new Date().toISOString() })

    return jsonResponse(deals)
  } catch (err) {
    return errorResponse(err)
  }
})

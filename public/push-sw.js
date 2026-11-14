// Avisos push (se suma al service worker de la app con `importScripts`, ver
// vite.config.ts). El aviso lo manda la Edge Function `episode-alerts` con un
// JSON { title, body, url, tag }; `url` es una ruta dentro de la app.

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const icon = new URL('icons/icon-192.png', self.registration.scope).href
  event.waitUntil(
    self.registration.showNotification(data.title || 'Shelf Life', {
      body: data.body || '',
      tag: data.tag,
      icon,
      badge: icon,
      data: { url: data.url || '' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '', self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Si la app ya está abierta, se usa esa ventana en vez de abrir otra.
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          if ('navigate' in client) client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})

import { defineConfig } from 'vitest/config'

// Tests de la lógica pura (src/lib): sin los plugins de la app (PWA,
// Tailwind). Las variables de Supabase son falsas: el cliente se crea pero
// los tests nunca llaman a la red.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})

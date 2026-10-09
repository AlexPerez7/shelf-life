import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { basePath } from './lib/appUrl'
import { migrateStorageKeys } from './lib/storageMigration'

// Antes del primer render: los providers leen sus claves al montar.
migrateStorageKeys()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basePath}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

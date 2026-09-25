import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Ask the browser to keep our data (login session + local ledger) and not evict
// it between launches — important for an installed PWA used daily.
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage
    .persisted?.()
    .then((already) => {
      if (!already) navigator.storage.persist().catch(() => {})
    })
    .catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

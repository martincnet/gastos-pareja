import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if ('serviceWorker' in navigator) {
  // Solo recargamos cuando una versión nueva reemplaza a otra, no en la primera instalación
  const habiaController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.register(`/firebase-messaging-sw.js?v=${__BUILD_ID__}`).catch(() => {})
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (habiaController) window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

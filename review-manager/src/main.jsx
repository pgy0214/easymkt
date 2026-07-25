import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Portal from './components/Portal.jsx'

const isPortal = window.location.pathname.startsWith('/portal')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPortal ? <Portal /> : <App />}
  </StrictMode>,
)

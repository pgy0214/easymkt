import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Advertiser from './components/Advertiser.jsx'
import Portal from './components/Portal.jsx'

const isPortal = window.location.pathname.startsWith('/portal')
const isAdvertiser = window.location.pathname.startsWith('/advertiser')

function Root() {
  if (isPortal) return <Portal />
  if (isAdvertiser) return <Advertiser />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

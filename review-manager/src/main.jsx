import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Advertiser from './components/Advertiser.jsx'
import ExperienceHome from './components/ExperienceHome.jsx'
import Portal from './components/Portal.jsx'

const path = window.location.pathname
const isAdmin = path.startsWith('/admin')
const isAdvertiser = path.startsWith('/ads')
const isExperienceHome = path.startsWith('/experience')

function Root() {
  if (isAdmin) return <App />
  if (isAdvertiser) return <Advertiser />
  if (isExperienceHome) {
    return (
      <ExperienceHome
        onStartLogin={() => {
          localStorage.setItem('portal_mode', 'experience')
          window.location.href = '/'
        }}
      />
    )
  }
  // 메인 도메인 — 리뷰어 포털이 기본 진입점
  return <Portal />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

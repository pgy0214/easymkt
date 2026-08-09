import { useState } from 'react'
import AdminAccountManager from './components/AdminAccountManager.jsx'
import AdminLogin from './components/AdminLogin.jsx'
import CampaignManager from './components/CampaignManager.jsx'
import ExperienceManager from './components/ExperienceManager.jsx'
import Nav from './components/Nav.jsx'
import ReceiptGenerator from './components/ReceiptGenerator.jsx'
import ReviewerManager from './components/ReviewerManager.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import SettlementSummary from './components/SettlementSummary.jsx'
import StoreManager from './components/StoreManager.jsx'
import TargetForm from './components/TargetForm.jsx'
import TaskDashboard from './components/TaskDashboard.jsx'

const TOKEN_KEY = 'admin_token'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [tab, setTab] = useState('reviewers')

  if (!token) {
    return (
      <AdminLogin
        onLoggedIn={(t) => {
          localStorage.setItem(TOKEN_KEY, t)
          setToken(t)
        }}
      />
    )
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-3 sm:px-4 sm:py-4">
        <h1 className="flex items-center gap-1.5 text-base font-semibold text-gray-900 sm:text-lg">
          <img src="/logo.svg" alt="" className="h-6 w-6" />
          이지리뷰 <span className="font-normal text-gray-400">(관리자모드)</span>
        </h1>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-800">
          로그아웃
        </button>
      </header>
      <Nav active={tab} onChange={setTab} />
      <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 sm:py-6">
        {tab === 'reviewers' && <ReviewerManager />}
        {tab === 'admin-accounts' && <AdminAccountManager />}
        {tab === 'stores' && <StoreManager />}
        {tab === 'targets' && <TargetForm />}
        {tab === 'tasks' && <TaskDashboard />}
        {tab === 'receipt' && <ReceiptGenerator />}
        {tab === 'campaigns' && <CampaignManager />}
        {tab === 'experience-pool' && <ExperienceManager />}
        {tab === 'settlement' && <SettlementSummary />}
        {tab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}

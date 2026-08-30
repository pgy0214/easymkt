import { useEffect, useState } from 'react'
import AdminAccountManager from './components/AdminAccountManager.jsx'
import CampaignManager from './components/CampaignManager.jsx'
import DraftGenerator from './components/DraftGenerator.jsx'
import ExperienceManager from './components/ExperienceManager.jsx'
import MemberManager from './components/MemberManager.jsx'
import Nav from './components/Nav.jsx'
import NoticeManager from './components/NoticeManager.jsx'
import OrderManager from './components/OrderManager.jsx'
import ProductManager from './components/ProductManager.jsx'
import ReceiptGenerator from './components/ReceiptGenerator.jsx'
import ReviewerManager from './components/ReviewerManager.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import SettlementSummary from './components/SettlementSummary.jsx'
import StoreManager from './components/StoreManager.jsx'
import TargetForm from './components/TargetForm.jsx'
import TaskDashboard from './components/TaskDashboard.jsx'

const TOKEN_KEY = 'admin_token'

function NoAdminAccess() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = '/'
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-card border border-gray-200 bg-white p-6 text-center">
        <img src="/logo.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
        <h1 className="mb-2 text-lg font-semibold text-gray-900">권한이 없습니다</h1>
        <p className="text-sm text-gray-500">
          관리자 계정으로 로그인해야 볼 수 있는 페이지입니다.
        </p>
        <p className="mt-3 text-xs text-gray-400">잠시 후 메인 페이지로 이동합니다...</p>
      </div>
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [tab, setTab] = useState('reviewers')

  if (!token) {
    return <NoAdminAccess />
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
        {tab === 'draft' && <DraftGenerator />}
        {tab === 'campaigns' && <CampaignManager />}
        {tab === 'experience-pool' && <ExperienceManager />}
        {tab === 'settlement' && <SettlementSummary />}
        {tab === 'settings' && <SettingsPanel />}
        {tab === 'members' && <MemberManager />}
        {tab === 'notices' && <NoticeManager />}
        {tab === 'products' && <ProductManager />}
        {tab === 'orders' && <OrderManager />}
      </main>
    </div>
  )
}

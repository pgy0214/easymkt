import { useState } from 'react'
import AdminAccountManager from './components/AdminAccountManager.jsx'
import Nav from './components/Nav.jsx'
import ReviewerManager from './components/ReviewerManager.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import SettlementSummary from './components/SettlementSummary.jsx'
import StoreManager from './components/StoreManager.jsx'
import TargetForm from './components/TargetForm.jsx'
import TaskDashboard from './components/TaskDashboard.jsx'

export default function App() {
  const [tab, setTab] = useState('reviewers')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-3 py-3 sm:px-4 sm:py-4">
        <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
          리뷰몬 <span className="font-normal text-slate-400">(관리자모드)</span>
        </h1>
      </header>
      <Nav active={tab} onChange={setTab} />
      <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 sm:py-6">
        {tab === 'reviewers' && <ReviewerManager />}
        {tab === 'admin-accounts' && <AdminAccountManager />}
        {tab === 'stores' && <StoreManager />}
        {tab === 'targets' && <TargetForm />}
        {tab === 'tasks' && <TaskDashboard />}
        {tab === 'settlement' && <SettlementSummary />}
        {tab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}

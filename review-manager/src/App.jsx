import { useState } from 'react'
import Nav from './components/Nav.jsx'
import ReviewerManager from './components/ReviewerManager.jsx'
import SettingsPanel from './components/SettingsPanel.jsx'
import SettlementSummary from './components/SettlementSummary.jsx'
import TargetForm from './components/TargetForm.jsx'
import TaskDashboard from './components/TaskDashboard.jsx'

export default function App() {
  const [tab, setTab] = useState('reviewers')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <h1 className="text-lg font-semibold text-slate-900">리뷰 관리 시스템</h1>
      </header>
      <Nav active={tab} onChange={setTab} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === 'reviewers' && <ReviewerManager />}
        {tab === 'targets' && <TargetForm />}
        {tab === 'tasks' && <TaskDashboard />}
        {tab === 'settlement' && <SettlementSummary />}
        {tab === 'settings' && <SettingsPanel />}
      </main>
    </div>
  )
}

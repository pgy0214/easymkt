import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import TaskFilters from './TaskFilters.jsx'
import TaskTable from './TaskTable.jsx'

const EMPTY_FILTERS = {
  reviewer_id: '',
  platform: '',
  status: '',
  blind_status: '',
  settlement_status: '',
}

const RECENTLY_EXPIRED_MS = 24 * 60 * 60 * 1000

export default function TaskDashboard() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [tasks, setTasks] = useState([])
  const [reviewers, setReviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recentlyExpiredCount, setRecentlyExpiredCount] = useState(0)

  async function refresh() {
    setLoading(true)
    try {
      setTasks(await api.getTasks(filters))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.getReviewers().then(setReviewers)
    api.getTasks({}).then((all) => {
      const count = all.filter(
        (t) => t.last_expired_at && Date.now() - new Date(t.last_expired_at).getTime() < RECENTLY_EXPIRED_MS,
      ).length
      setRecentlyExpiredCount(count)
    })
  }, [])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  async function handleSubmitResult(taskId, link) {
    try {
      await api.updateTaskResult(taskId, link)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleUpdateSettlement(taskId, data) {
    try {
      await api.updateTaskSettlement(taskId, data)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-4">
      {recentlyExpiredCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          최근 24시간 내 {recentlyExpiredCount}건이 클레임 기한을 넘겨 오픈풀로 복귀했습니다.
        </div>
      )}
      <TaskFilters filters={filters} onChange={setFilters} reviewers={reviewers} />
      {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <TaskTable
        tasks={tasks}
        onSubmitResult={handleSubmitResult}
        onUpdateSettlement={handleUpdateSettlement}
      />
    </div>
  )
}

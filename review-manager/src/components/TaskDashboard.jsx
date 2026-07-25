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
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [rechecking, setRechecking] = useState(false)

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
    setSelectedIds(new Set())
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

  function toggleSelect(taskId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function toggleSelectAllCompleted() {
    const completedIds = tasks.filter((t) => t.status === 'completed').map((t) => t.id)
    setSelectedIds((prev) =>
      completedIds.every((id) => prev.has(id)) ? new Set() : new Set(completedIds),
    )
  }

  async function handleRecheckOne(taskId) {
    setRechecking(true)
    try {
      await api.recheckBlind(taskId)
      await refresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setRechecking(false)
    }
  }

  async function handleRecheckSelected() {
    if (selectedIds.size === 0) return
    setRechecking(true)
    const ids = Array.from(selectedIds)
    const failures = []
    for (const id of ids) {
      try {
        await api.recheckBlind(id)
      } catch (err) {
        failures.push(`#${id}: ${err.message}`)
      }
    }
    setRechecking(false)
    setSelectedIds(new Set())
    await refresh()
    if (failures.length > 0) {
      alert(`일부 확인 실패:\n${failures.join('\n')}`)
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

      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <button
          onClick={handleRecheckSelected}
          disabled={selectedIds.size === 0 || rechecking}
          className="rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {rechecking ? '확인 중...' : `선택 항목 블라인드 재확인 (${selectedIds.size})`}
        </button>
        <span className="text-xs text-slate-400">
          완료된 작업만 선택 가능합니다. 자동 확인 주기는 "설정" 탭에서 조정할 수 있어요.
        </span>
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <TaskTable
        tasks={tasks}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAllCompleted}
        onRecheckOne={handleRecheckOne}
        rechecking={rechecking}
        onSubmitResult={handleSubmitResult}
        onUpdateSettlement={handleUpdateSettlement}
      />
    </div>
  )
}

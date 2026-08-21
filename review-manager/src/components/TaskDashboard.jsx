import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import BlindBulkCheckPanel from './BlindBulkCheckPanel.jsx'
import DateRangePicker from './DateRangePicker.jsx'
import TaskFilters from './TaskFilters.jsx'
import TaskTable from './TaskTable.jsx'
import Button from './ui/Button.jsx'

function todayInput() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const EMPTY_FILTERS = {
  reviewer_id: '',
  platform: '',
  status: '',
  blind_status: '',
  settlement_status: '',
  reviewer_category: '',
}

const RECENTLY_EXPIRED_MS = 24 * 60 * 60 * 1000

export default function TaskDashboard() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [dateRange, setDateRange] = useState(() => ({ from: todayInput(), to: todayInput() }))
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
      setTasks(
        await api.getTasks({ ...filters, created_from: dateRange.from, created_to: dateRange.to }),
      )
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
  }, [filters, dateRange])

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

  function toggleSelectAllCompleted(ids) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = ids.every((id) => next.has(id))
      for (const id of ids) {
        if (allSelected) next.delete(id)
        else next.add(id)
      }
      return next
    })
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

  const totalCount = tasks.length
  const remainingCount = tasks.filter((t) => t.status === 'open').length

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-gray-200 bg-white p-4">
        <p className="text-xs text-gray-500">선택한 기간 기준 ({dateRange.from || '전체'} ~ {dateRange.to || '전체'})</p>
        <div className="mt-1 flex items-center gap-8">
          <div>
            <p className="text-2xl font-bold tabular-nums text-gray-900">{totalCount}</p>
            <p className="text-xs text-gray-500">총 작업</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-brand-600">{remainingCount}</p>
            <p className="text-xs text-gray-500">잔여(오픈풀)</p>
          </div>
        </div>
      </div>

      {recentlyExpiredCount > 0 && (
        <div className="rounded-card border border-amber-200 bg-warning-bg px-3 py-2 text-sm text-warning-text">
          최근 24시간 내 {recentlyExpiredCount}건이 클레임 기한을 넘겨 오픈풀로 복귀했습니다.
        </div>
      )}

      <div className="rounded-card border border-gray-200 bg-white p-3">
        <p className="mb-2 text-xs text-gray-500">기간별 조회 (등록일 기준)</p>
        <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
      </div>

      <TaskFilters filters={filters} onChange={setFilters} reviewers={reviewers} />

      <div className="flex items-center gap-3 rounded-card border border-gray-200 bg-white px-3 py-2">
        <Button onClick={handleRecheckSelected} disabled={selectedIds.size === 0 || rechecking} variant="secondary">
          {rechecking ? '확인 중...' : `선택 항목 블라인드 재확인 (${selectedIds.size})`}
        </Button>
        <span className="text-xs text-gray-400">
          완료된 작업만 선택 가능합니다. 자동 확인 주기는 "설정" 탭에서 조정할 수 있어요.
        </span>
      </div>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
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

      <BlindBulkCheckPanel />
    </div>
  )
}

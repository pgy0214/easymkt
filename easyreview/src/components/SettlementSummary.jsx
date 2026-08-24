import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import DateRangePicker from './DateRangePicker.jsx'
import { formatKRW } from '../lib/format.js'
import Button from './ui/Button.jsx'

function todayInput() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function SettlementSummary() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [totalRevenue, setTotalRevenue] = useState(null)
  const [periodRevenue, setPeriodRevenue] = useState(null)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  const [unpaidRange, setUnpaidRange] = useState(() => ({ from: todayInput(), to: todayInput() }))
  const [unpaidTasks, setUnpaidTasks] = useState([])
  const [unpaidLoading, setUnpaidLoading] = useState(true)
  const [unpaidError, setUnpaidError] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    api
      .getSettlementSummary()
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    api.getRevenue().then(setTotalRevenue)
  }, [])

  useEffect(() => {
    api.getRevenue(dateRange.from, dateRange.to).then(setPeriodRevenue)
  }, [dateRange])

  async function refreshUnpaid() {
    setUnpaidLoading(true)
    try {
      const tasks = await api.getTasks({
        status: 'completed',
        settlement_status: 'unpaid',
        completed_from: unpaidRange.from,
        completed_to: unpaidRange.to,
      })
      setUnpaidTasks(tasks)
      setUnpaidError(null)
    } catch (err) {
      setUnpaidError(err.message)
    } finally {
      setUnpaidLoading(false)
    }
  }

  useEffect(() => {
    refreshUnpaid()
    setSelectedIds(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unpaidRange])

  function toggleSelect(taskId) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === unpaidTasks.length ? new Set() : new Set(unpaidTasks.map((t) => t.id)),
    )
  }

  async function handleSettleSelected() {
    if (selectedIds.size === 0) return
    setSettling(true)
    const failures = []
    for (const id of selectedIds) {
      try {
        await api.updateTaskSettlement(id, { settlement_status: 'paid' })
      } catch (err) {
        failures.push(`#${id}: ${err.message}`)
      }
    }
    setSettling(false)
    setSelectedIds(new Set())
    await refreshUnpaid()
    api.getSettlementSummary().then(setRows)
    if (failures.length > 0) {
      alert(`일부 정산 실패:\n${failures.join('\n')}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-card border border-gray-200 bg-white p-3">
        <h3 className="mb-2 text-sm font-medium text-gray-700">미정산건 일괄조회 (작업일 기준)</h3>
        <DateRangePicker from={unpaidRange.from} to={unpaidRange.to} onChange={setUnpaidRange} />

        {unpaidLoading && <p className="mt-2 text-sm text-gray-400">불러오는 중...</p>}
        {unpaidError && <p className="mt-2 text-sm text-danger-text">{unpaidError}</p>}
        {!unpaidLoading && !unpaidError && unpaidTasks.length === 0 && (
          <p className="mt-2 text-sm text-gray-400">선택한 기간에 미정산 작업이 없습니다</p>
        )}
        {!unpaidLoading && unpaidTasks.length > 0 && (
          <>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={handleSettleSelected} disabled={selectedIds.size === 0 || settling}>
                {settling ? '정산 처리 중...' : `선택 정산완료 (${selectedIds.size})`}
              </Button>
            </div>
            <div className="mt-2 overflow-x-auto rounded-card border border-gray-200">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === unpaidTasks.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-3 py-2">리뷰어</th>
                    <th className="px-3 py-2">계좌번호</th>
                    <th className="px-3 py-2">매장</th>
                    <th className="px-3 py-2">금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {unpaidTasks.map((task) => (
                    <tr key={task.id}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(task.id)}
                          onChange={() => toggleSelect(task.id)}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{task.reviewer_name ?? '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{task.reviewer_bank_account ?? '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{task.store_name}</td>
                      <td className="px-3 py-2 text-gray-600">{formatKRW(task.settlement_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">전체 매출 (완료된 작업 전체, 매장 청구 기준)</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {totalRevenue ? formatKRW(totalRevenue.total) : '-'}
          </p>
          {totalRevenue && <p className="text-xs text-gray-400">{totalRevenue.count}건</p>}
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">기간별 매출 (완료일 기준)</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {periodRevenue ? formatKRW(periodRevenue.total) : '-'}
          </p>
          {periodRevenue && <p className="text-xs text-gray-400">{periodRevenue.count}건</p>}
          <div className="mt-2">
            <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        매출은 캠페인 등록 시 "건당 판매금액"을 입력한 작업만 집계됩니다. 판매금액을 입력하지
        않은 작업은 매출 계산에서 빠집니다.
      </p>

      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">미정산건 일괄조회 (리뷰어별)</h3>
        {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
        {error && <p className="text-sm text-danger-text">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="text-sm text-gray-400">완료된 작업이 없습니다</p>
        )}
        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto rounded-card border border-gray-200 bg-white">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2">리뷰어</th>
                  <th className="px-3 py-2">완료 건수</th>
                  <th className="px-3 py-2">미정산 금액</th>
                  <th className="px-3 py-2">정산완료 금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.reviewer_id}>
                    <td className="px-3 py-2 font-medium text-gray-800">{row.reviewer_name}</td>
                    <td className="px-3 py-2">{row.completed_count}건</td>
                    <td className="px-3 py-2 text-warning-text">{formatKRW(row.unpaid_amount)}</td>
                    <td className="px-3 py-2 text-success-text">{formatKRW(row.paid_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1 text-xs text-gray-400">
          관리자(자체보유계정)는 정산 대상이 아니라 이 목록에서 제외됩니다.
        </p>
      </div>
    </div>
  )
}

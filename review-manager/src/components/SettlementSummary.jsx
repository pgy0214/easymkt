import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import DateRangePicker from './DateRangePicker.jsx'
import { formatKRW } from '../lib/format.js'

export default function SettlementSummary() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [totalRevenue, setTotalRevenue] = useState(null)
  const [periodRevenue, setPeriodRevenue] = useState(null)
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">전체 매출 (완료된 작업 전체, 매장 청구 기준)</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {totalRevenue ? formatKRW(totalRevenue.total) : '-'}
          </p>
          {totalRevenue && <p className="text-xs text-slate-400">{totalRevenue.count}건</p>}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">기간별 매출 (완료일 기준)</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {periodRevenue ? formatKRW(periodRevenue.total) : '-'}
          </p>
          {periodRevenue && <p className="text-xs text-slate-400">{periodRevenue.count}건</p>}
          <div className="mt-2">
            <DateRangePicker from={dateRange.from} to={dateRange.to} onChange={setDateRange} />
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        매출은 캠페인 등록 시 "건당 판매금액"을 입력한 작업만 집계됩니다. 판매금액을 입력하지
        않은 작업은 매출 계산에서 빠집니다.
      </p>

      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-700">미정산건 일괄조회 (리뷰어별)</h3>
        {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="text-sm text-slate-400">완료된 작업이 없습니다</p>
        )}
        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">리뷰어</th>
                  <th className="px-3 py-2">완료 건수</th>
                  <th className="px-3 py-2">미정산 금액</th>
                  <th className="px-3 py-2">정산완료 금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.reviewer_id}>
                    <td className="px-3 py-2 font-medium text-slate-800">{row.reviewer_name}</td>
                    <td className="px-3 py-2">{row.completed_count}건</td>
                    <td className="px-3 py-2 text-amber-700">{formatKRW(row.unpaid_amount)}</td>
                    <td className="px-3 py-2 text-green-700">{formatKRW(row.paid_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1 text-xs text-slate-400">
          관리자(자체보유계정)는 정산 대상이 아니라 이 목록에서 제외됩니다.
        </p>
      </div>
    </div>
  )
}

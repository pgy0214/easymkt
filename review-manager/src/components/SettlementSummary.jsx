import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { formatKRW } from '../lib/format.js'

export default function SettlementSummary() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .getSettlementSummary()
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-slate-400">불러오는 중...</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (rows.length === 0) return <p className="text-sm text-slate-400">완료된 작업이 없습니다</p>

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
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
  )
}

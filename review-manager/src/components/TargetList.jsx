import { Trash2 } from 'lucide-react'
import { formatDateTime, formatKRW, PLATFORM_LABEL } from '../lib/format.js'

export default function TargetList({ targets, onDelete }) {
  if (targets.length === 0) {
    return <p className="text-sm text-slate-400">등록된 캠페인이 없습니다</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2">플랫폼</th>
            <th className="px-3 py-2">가게명</th>
            <th className="px-3 py-2">건수</th>
            <th className="px-3 py-2">단가</th>
            <th className="px-3 py-2">작업 제한</th>
            <th className="px-3 py-2">등록일</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {targets.map((target) => (
            <tr key={target.id}>
              <td className="px-3 py-2">{PLATFORM_LABEL[target.platform]}</td>
              <td className="px-3 py-2">
                <a
                  href={target.store_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {target.store_name}
                </a>
              </td>
              <td className="px-3 py-2">{target.required_count}건</td>
              <td className="px-3 py-2">{formatKRW(target.unit_price)}</td>
              <td className="px-3 py-2">{target.claim_time_limit_minutes}분</td>
              <td className="px-3 py-2 text-slate-500">{formatDateTime(target.created_at)}</td>
              <td className="px-3 py-2">
                <button
                  onClick={() => onDelete(target.id)}
                  className="text-slate-400 hover:text-red-600"
                  title="캠페인 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

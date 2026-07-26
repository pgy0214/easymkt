import { ChevronDown, ChevronRight, FileText, Pencil, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatDateRange, formatDateTime, formatKRW, formatWorkDays, PLATFORM_LABEL } from '../lib/format.js'
import TargetDataModal from './TargetDataModal.jsx'
import TargetEditModal from './TargetEditModal.jsx'

export default function TargetList({ targets, onDelete, onUpdated }) {
  const [dataModalTargetId, setDataModalTargetId] = useState(null)
  const [editingTarget, setEditingTarget] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all') // all | in_progress | completed
  const [storeSearch, setStoreSearch] = useState('')
  const [listOpen, setListOpen] = useState(true)

  const filtered = useMemo(() => {
    const query = storeSearch.trim().toLowerCase()
    return targets.filter((target) => {
      const isCompleted = target.completed_count >= target.required_count
      if (statusFilter === 'in_progress' && isCompleted) return false
      if (statusFilter === 'completed' && !isCompleted) return false
      if (query && !target.store_name?.toLowerCase().includes(query)) return false
      return true
    })
  }, [targets, statusFilter, storeSearch])

  function handleSaved(updated) {
    setEditingTarget(null)
    onUpdated(updated)
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setListOpen((prev) => !prev)}
        className="flex items-center gap-1 text-base font-semibold text-slate-800"
      >
        {listOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        캠페인 목록
      </button>

      {listOpen && (
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            placeholder="매장명 검색"
            className="w-48 rounded border border-slate-300 py-1 pl-7 pr-2 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="all">전체 상태</option>
          <option value="in_progress">진행중</option>
          <option value="completed">완료</option>
        </select>
      </div>
      )}

      {listOpen && (targets.length === 0 ? (
        <p className="text-sm text-slate-400">등록된 캠페인이 없습니다</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-400">조건에 맞는 캠페인이 없습니다</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">플랫폼</th>
                <th className="px-3 py-2">가게명</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2">건수</th>
                <th className="px-3 py-2">단가(정산)</th>
                <th className="px-3 py-2">판매금액</th>
                <th className="px-3 py-2">작업 제한</th>
                <th className="px-3 py-2">1일 갯수</th>
                <th className="px-3 py-2">노출요일</th>
                <th className="px-3 py-2">작업 기간</th>
                <th className="px-3 py-2">등록일</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((target) => {
                const isCompleted = target.completed_count >= target.required_count
                return (
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
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                          isCompleted ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {isCompleted ? '완료' : '진행중'} ({target.completed_count}/{target.required_count})
                      </span>
                    </td>
                    <td className="px-3 py-2">{target.required_count}건</td>
                    <td className="px-3 py-2">{formatKRW(target.unit_price)}</td>
                    <td className="px-3 py-2">{target.sale_price != null ? formatKRW(target.sale_price) : '-'}</td>
                    <td className="px-3 py-2">{target.claim_time_limit_minutes}분</td>
                    <td className="px-3 py-2">{target.daily_limit != null ? `${target.daily_limit}건` : '제한없음'}</td>
                    <td className="px-3 py-2">{formatWorkDays(target.work_days)}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {formatDateRange(target.start_date, target.end_date)}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{formatDateTime(target.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDataModalTargetId(target.id)}
                          className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <FileText size={12} />
                          작업데이터
                        </button>
                        <button
                          onClick={() => setEditingTarget(target)}
                          className="text-slate-400 hover:text-blue-600"
                          title="캠페인 수정"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(target.id)}
                          className="text-slate-400 hover:text-red-600"
                          title="캠페인 삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {dataModalTargetId != null && (
        <TargetDataModal targetId={dataModalTargetId} onClose={() => setDataModalTargetId(null)} />
      )}
      {editingTarget && (
        <TargetEditModal
          target={editingTarget}
          onClose={() => setEditingTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

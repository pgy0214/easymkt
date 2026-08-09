import { ChevronDown, ChevronRight, FileText, MessageSquare, Pencil, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { formatDateRange, formatDateTime, formatKRW, formatWorkDays, PLATFORM_LABEL } from '../lib/format.js'
import Badge from './ui/Badge.jsx'
import Input from './ui/Input.jsx'
import BulkMessageModal from './BulkMessageModal.jsx'
import TargetDataModal from './TargetDataModal.jsx'
import TargetEditModal from './TargetEditModal.jsx'

export default function TargetList({ targets, onDelete, onUpdated }) {
  const [dataModalTargetId, setDataModalTargetId] = useState(null)
  const [editingTarget, setEditingTarget] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all') // all | in_progress | completed
  const [storeSearch, setStoreSearch] = useState('')
  const [listOpen, setListOpen] = useState(true)
  const [smsTarget, setSmsTarget] = useState(null)
  const [smsReviewers, setSmsReviewers] = useState([])
  const [smsMessage, setSmsMessage] = useState('')
  const [preparingSmsId, setPreparingSmsId] = useState(null)

  // 그 매장(target.store_id)에 지금 신청 가능한 계정을 가진 리뷰어만 추려서 기본
  // 선택 상태로 넘긴다 — ReviewerManager.jsx의 "작업 매장으로 필터링" 로직(계정별
  // getAccountStoreHistory 호출)과 동일한 방식.
  async function handleOpenSms(target) {
    setPreparingSmsId(target.id)
    try {
      const allReviewers = await api.getReviewers()
      const candidates = allReviewers.filter((r) => r.category !== 'admin' && r.is_active)
      const accountRefs = []
      candidates.forEach((r) => {
        r.accounts
          .filter((a) => a.platform === target.platform)
          .forEach((a) => accountRefs.push({ reviewerId: r.id, accountId: a.id }))
      })
      const histories = await Promise.all(
        accountRefs.map((ref) => api.getAccountStoreHistory(ref.accountId)),
      )
      const eligibleIds = new Set()
      histories.forEach((history, i) => {
        const entry = history.find((h) => h.store_id === target.store_id)
        if (!entry || entry.is_eligible_now) eligibleIds.add(accountRefs[i].reviewerId)
      })
      setSmsReviewers(candidates.filter((r) => eligibleIds.has(r.id)))
      setSmsMessage(
        `[이지리뷰] ${target.store_name} 신규 캠페인이 열렸습니다 (건당 ${formatKRW(target.unit_price)}). 리뷰어 로그인에서 오픈풀을 확인하고 신청해주세요.`,
      )
      setSmsTarget(target)
    } finally {
      setPreparingSmsId(null)
    }
  }

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
        className="flex items-center gap-1 text-base font-semibold text-gray-800"
      >
        {listOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        캠페인 목록
      </button>

      {listOpen && (
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            value={storeSearch}
            onChange={(e) => setStoreSearch(e.target.value)}
            placeholder="매장명 검색"
            className="w-48 pl-7"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
          <option value="all">전체 상태</option>
          <option value="in_progress">진행중</option>
          <option value="completed">완료</option>
        </select>
      </div>
      )}

      {listOpen && (targets.length === 0 ? (
        <p className="text-sm text-gray-400">등록된 캠페인이 없습니다</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">조건에 맞는 캠페인이 없습니다</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-gray-200 bg-white">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
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
            <tbody className="divide-y divide-gray-100">
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
                        className="text-brand-600 hover:underline"
                      >
                        {target.store_name}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={isCompleted ? 'neutral' : 'success'}>
                        {isCompleted ? '완료' : '진행중'} ({target.completed_count}/{target.required_count})
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{target.required_count}건</td>
                    <td className="px-3 py-2">{formatKRW(target.unit_price)}</td>
                    <td className="px-3 py-2">{target.sale_price != null ? formatKRW(target.sale_price) : '-'}</td>
                    <td className="px-3 py-2">{target.claim_time_limit_minutes}분</td>
                    <td className="px-3 py-2">{target.daily_limit != null ? `${target.daily_limit}건` : '제한없음'}</td>
                    <td className="px-3 py-2">{formatWorkDays(target.work_days)}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {formatDateRange(target.start_date, target.end_date)}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{formatDateTime(target.created_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDataModalTargetId(target.id)}
                          className="flex items-center gap-1 rounded-btn border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <FileText size={12} />
                          작업데이터
                        </button>
                        <button
                          onClick={() => handleOpenSms(target)}
                          disabled={preparingSmsId === target.id}
                          className="flex items-center gap-1 rounded-btn border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <MessageSquare size={12} />
                          {preparingSmsId === target.id ? '대상 확인 중...' : '문자 발송'}
                        </button>
                        <button
                          onClick={() => setEditingTarget(target)}
                          className="text-gray-400 hover:text-brand-600"
                          title="캠페인 수정"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => onDelete(target.id)}
                          className="text-gray-400 hover:text-danger-text"
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
      {smsTarget && (
        <BulkMessageModal
          reviewers={smsReviewers}
          initialMessage={smsMessage}
          onClose={() => setSmsTarget(null)}
        />
      )}
    </div>
  )
}

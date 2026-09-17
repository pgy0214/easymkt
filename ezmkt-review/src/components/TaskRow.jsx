import { useState } from 'react'
import { formatDate, formatDateTime, PLATFORM_LABEL, STATUS_LABEL } from '../lib/format.js'
import Badge from './ui/Badge.jsx'

const BLIND_VARIANT = {
  unknown: 'neutral',
  visible: 'success',
  blinded: 'danger',
}
const BLIND_TEXT = {
  unknown: '미확인',
  visible: '정상노출',
  blinded: '블라인드',
}

const SELF_MANAGED_CATEGORIES = ['own', 'admin']

const RECENTLY_EXPIRED_MS = 24 * 60 * 60 * 1000

export default function TaskRow({
  task,
  selected,
  onToggleSelect,
  onRecheckOne,
  rechecking,
  onSubmitResult,
  onCompleteTask,
  onRejectTask,
}) {
  const [linkInput, setLinkInput] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  const isSelfManaged = SELF_MANAGED_CATEGORIES.includes(task.reviewer_category)
  // 자체보유(own/admin) 계정은 관리자가 곧 확인자라 링크 입력과 동시에 완료 처리한다.
  // 실제 리뷰어는 포털에서 먼저 제출(submitted)하고, 관리자는 결과보기로 확인한 뒤 완료를 누른다.
  const canEnterResult =
    isSelfManaged && (task.status === 'ready' || (task.platform === 'kakao' && task.status === 'claimed'))
  const isSubmitted = task.status === 'submitted'
  const isCompleted = task.status === 'completed'
  const isOpen = task.status === 'open'
  const recentlyExpired =
    task.last_expired_at &&
    Date.now() - new Date(task.last_expired_at).getTime() < RECENTLY_EXPIRED_MS

  return (
    <tr className={`align-top ${recentlyExpired ? 'bg-warning-bg' : ''}`}>
      <td className="px-3 py-2">
        {isCompleted && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(task.id)}
          />
        )}
      </td>
      <td className="px-3 py-2 text-xs text-gray-500">{task.task_no}</td>
      <td className="px-3 py-2">
        {isOpen ? (
          <div className="text-sm text-gray-400">미배정 (오픈풀)</div>
        ) : (
          <>
            <div className="font-medium text-gray-800">{task.reviewer_name ?? '-'}</div>
            {task.reviewer_contact_info && (
              <div className="text-xs text-gray-500">{task.reviewer_contact_info}</div>
            )}
            <div className="text-xs text-gray-400">{task.account_label}</div>
          </>
        )}
        {task.claim_deadline && !isCompleted && !isSubmitted && (
          <div className="text-xs text-gray-400">기한: {formatDateTime(task.claim_deadline)}</div>
        )}
        {recentlyExpired && (
          <div className="mt-1 text-xs font-medium text-warning-text">기한초과로 오픈풀 복귀됨</div>
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">{PLATFORM_LABEL[task.platform]}</td>
      <td className="px-3 py-2 text-gray-600">{STATUS_LABEL[task.status] ?? task.status}</td>
      <td className="px-3 py-2 text-xs">
        {task.platform === 'naver' && (
          <>
            <div>영수증 날짜: {formatDate(task.naver_available_date)}</div>
            <div>작성일: {formatDate(task.review_posted_date)}</div>
          </>
        )}
        {task.platform === 'kakao' && <div>작성일: {formatDate(task.review_posted_date)}</div>}
      </td>
      <td className="px-3 py-2">
        {isCompleted ? (
          <a
            href={task.result_link}
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:underline"
          >
            결과 보기
          </a>
        ) : isSubmitted ? (
          <div>
            <div className="flex items-center gap-1">
              <a
                href={task.result_link}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline"
              >
                결과 보기
              </a>
              <button
                onClick={() => onCompleteTask(task.id)}
                className="rounded bg-gray-800 px-2 py-0.5 text-xs text-white hover:bg-gray-700"
              >
                완료
              </button>
              <button
                onClick={() => setShowReject((v) => !v)}
                className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                반려
              </button>
            </div>
            {showReject && (
              <div className="mt-1 flex gap-1">
                <input
                  lang="ko"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="수정사항을 입력하세요"
                  className="w-40 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                />
                <button
                  onClick={() => {
                    if (!rejectReason.trim()) return
                    onRejectTask(task.id, rejectReason.trim())
                    setRejectReason('')
                    setShowReject(false)
                  }}
                  className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                >
                  반려하기
                </button>
              </div>
            )}
          </div>
        ) : canEnterResult ? (
          <div className="flex gap-1">
            <input
              lang="ko"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="결과 링크"
              className="w-32 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
            />
            <button
              onClick={() => linkInput.trim() && onSubmitResult(task.id, linkInput.trim())}
              className="rounded bg-gray-800 px-2 py-0.5 text-xs text-white hover:bg-gray-700"
            >
              완료
            </button>
          </div>
        ) : (
          <span className="text-xs text-gray-400">대기중</span>
        )}
      </td>
      <td className="px-3 py-2">
        <Badge variant={BLIND_VARIANT[task.blind_status]}>{BLIND_TEXT[task.blind_status]}</Badge>
        {task.check_expired && (
          <div className="mt-1 text-xs text-warning-text">확인기간 만료</div>
        )}
        {isCompleted && (
          <button
            onClick={() => onRecheckOne(task.id)}
            disabled={rechecking}
            className="mt-1 block text-xs text-brand-600 hover:underline disabled:opacity-50"
          >
            지금 재확인
          </button>
        )}
      </td>
    </tr>
  )
}

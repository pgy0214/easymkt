import { useState } from 'react'
import { formatDate, formatDateTime, formatKRW, PLATFORM_LABEL, STATUS_LABEL } from '../lib/format.js'
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

const RECENTLY_EXPIRED_MS = 24 * 60 * 60 * 1000

export default function TaskRow({
  task,
  selected,
  onToggleSelect,
  onRecheckOne,
  rechecking,
  onSubmitResult,
  onUpdateSettlement,
}) {
  const [linkInput, setLinkInput] = useState('')
  const [amount, setAmount] = useState(task.settlement_amount)

  const canEnterResult =
    task.status === 'ready' || (task.platform === 'kakao' && task.status === 'claimed')
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
        {task.claim_deadline && !isCompleted && (
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
        ) : canEnterResult ? (
          <div className="flex gap-1">
            <input
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
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
          />
          <button
            onClick={() =>
              onUpdateSettlement(task.id, {
                settlement_status: task.settlement_status === 'paid' ? 'unpaid' : 'paid',
                settlement_amount: amount,
              })
            }
            className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${
              task.settlement_status === 'paid'
                ? 'bg-success-bg text-success-text'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {task.settlement_status === 'paid' ? '정산완료' : '미정산'}
          </button>
        </div>
        <div className="mt-1 text-xs text-gray-400">{formatKRW(amount)}</div>
      </td>
    </tr>
  )
}

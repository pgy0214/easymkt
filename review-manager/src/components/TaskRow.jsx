import { useState } from 'react'
import { formatDate, formatDateTime, formatKRW, PLATFORM_LABEL, STATUS_LABEL } from '../lib/format.js'

const BLIND_BADGE = {
  unknown: 'bg-slate-100 text-slate-500',
  visible: 'bg-green-100 text-green-700',
  blinded: 'bg-red-100 text-red-700',
}
const BLIND_TEXT = {
  unknown: '미확인',
  visible: '정상노출',
  blinded: '블라인드',
}

const RECENTLY_EXPIRED_MS = 24 * 60 * 60 * 1000

export default function TaskRow({ task, onSubmitResult, onUpdateSettlement }) {
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
    <tr className={`align-top ${recentlyExpired ? 'bg-amber-50' : ''}`}>
      <td className="px-3 py-2">
        {isOpen ? (
          <div className="text-sm text-slate-400">미배정 (오픈풀)</div>
        ) : (
          <>
            <div className="font-medium text-slate-800">{task.reviewer_name ?? '-'}</div>
            {task.reviewer_contact_info && (
              <div className="text-xs text-slate-500">{task.reviewer_contact_info}</div>
            )}
            <div className="text-xs text-slate-400">{task.account_label}</div>
          </>
        )}
        {task.claim_deadline && !isCompleted && (
          <div className="text-xs text-slate-400">기한: {formatDateTime(task.claim_deadline)}</div>
        )}
        {recentlyExpired && (
          <div className="mt-1 text-xs font-medium text-amber-700">기한초과로 오픈풀 복귀됨</div>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="text-xs text-slate-500">{PLATFORM_LABEL[task.platform]}</div>
        <div className="text-slate-700">{task.store_name}</div>
      </td>
      <td className="px-3 py-2 text-slate-600">{STATUS_LABEL[task.status] ?? task.status}</td>
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
            className="text-blue-600 hover:underline"
          >
            결과 보기
          </a>
        ) : canEnterResult ? (
          <div className="flex gap-1">
            <input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="결과 링크"
              className="w-32 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
            />
            <button
              onClick={() => linkInput.trim() && onSubmitResult(task.id, linkInput.trim())}
              className="rounded bg-slate-800 px-2 py-0.5 text-xs text-white hover:bg-slate-700"
            >
              완료
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">대기중</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${BLIND_BADGE[task.blind_status]}`}>
          {BLIND_TEXT[task.blind_status]}
        </span>
        {task.check_expired && (
          <div className="mt-1 text-xs text-amber-600">확인기간 만료</div>
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
          />
          <button
            onClick={() =>
              onUpdateSettlement(task.id, {
                settlement_status: task.settlement_status === 'paid' ? 'unpaid' : 'paid',
                settlement_amount: amount,
              })
            }
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              task.settlement_status === 'paid'
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {task.settlement_status === 'paid' ? '정산완료' : '미정산'}
          </button>
        </div>
        <div className="mt-1 text-xs text-slate-400">{formatKRW(amount)}</div>
      </td>
    </tr>
  )
}

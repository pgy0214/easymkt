import { Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { GENDER_LABEL, REVIEWER_CATEGORY_LABEL } from '../lib/format.js'
import AccountForm from './AccountForm.jsx'
import AccountStoreBadges from './AccountStoreBadges.jsx'
import AssignTaskModal from './AssignTaskModal.jsx'

const PLATFORM_BADGE = {
  naver: 'bg-green-100 text-green-700',
  kakao: 'bg-yellow-100 text-yellow-700',
}

const CATEGORY_BADGE = {
  admin: 'bg-purple-100 text-purple-700',
  reviewer: 'bg-slate-100 text-slate-600',
  experience: 'bg-pink-100 text-pink-700',
  press: 'bg-blue-100 text-blue-700',
}

const GENDER_BADGE = {
  male: 'bg-sky-100 text-sky-700',
  female: 'bg-rose-100 text-rose-700',
}

export default function ReviewerCard({
  reviewer,
  selected = false,
  onToggleSelect,
  onDeleteReviewer,
  onToggleActive,
  onCreateAccount,
  onDeleteAccount,
}) {
  const [assigning, setAssigning] = useState(false)

  return (
    <div className={`rounded-lg border bg-white p-4 ${reviewer.is_active ? 'border-slate-200' : 'border-slate-200 opacity-70'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect(reviewer.id)}
              />
            )}
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${CATEGORY_BADGE[reviewer.category]}`}
            >
              {REVIEWER_CATEGORY_LABEL[reviewer.category]}
            </span>
            <h3 className="font-semibold text-slate-900">{reviewer.name}</h3>
            {reviewer.gender && (
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${GENDER_BADGE[reviewer.gender]}`}>
                {GENDER_LABEL[reviewer.gender]}
              </span>
            )}
            <button
              onClick={() => onToggleActive(reviewer.id, !reviewer.is_active)}
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                reviewer.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {reviewer.is_active ? '연락가능' : '연락불가'}
            </button>
          </div>
          {reviewer.memo && <p className="text-sm text-slate-500">{reviewer.memo}</p>}
          {reviewer.contact_info && (
            <p className="text-sm text-slate-600">연락처: {reviewer.contact_info}</p>
          )}
          {reviewer.category === 'experience' && (reviewer.region || reviewer.age_group || reviewer.blog_index) && (
            <p className="text-xs text-slate-500">
              {[reviewer.region, reviewer.blog_index && `지수 ${reviewer.blog_index}`, reviewer.age_group]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {reviewer.category === 'experience' && reviewer.blog_url && (
            <a
              href={reviewer.blog_url}
              target="_blank"
              rel="noreferrer"
              className="block text-xs text-blue-600 hover:underline"
            >
              {reviewer.blog_url}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAssigning(true)}
            className="text-slate-400 hover:text-blue-600"
            title="작업 배정"
          >
            <Send size={16} />
          </button>
          <button
            onClick={() => onDeleteReviewer(reviewer.id)}
            className="text-slate-400 hover:text-red-600"
            title="리뷰어 삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {reviewer.accounts.length === 0 && (
          <p className="text-sm text-slate-400">등록된 계정이 없습니다</p>
        )}
        {reviewer.accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${PLATFORM_BADGE[account.platform]}`}>
                {account.platform === 'naver' ? '네이버' : '카카오'}
              </span>
              <span className="font-medium text-slate-700">{account.label}</span>
              {account.profile_url && (
                <a
                  href={account.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  프로필
                </a>
              )}
              {account.ip_address && (
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600">
                  IP {account.ip_address}
                </span>
              )}
              <AccountStoreBadges account={account} />
            </div>
            <button
              onClick={() => onDeleteAccount(reviewer.id, account.id)}
              className="shrink-0 text-slate-400 hover:text-red-600"
              title="계정 삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <AccountForm onCreate={(data) => onCreateAccount(reviewer.id, data)} />

      {assigning && (
        <AssignTaskModal
          reviewer={reviewer}
          onClose={() => setAssigning(false)}
          onAssigned={() => setAssigning(false)}
        />
      )}
    </div>
  )
}

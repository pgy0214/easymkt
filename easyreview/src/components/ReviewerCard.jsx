import { ChevronDown, ClipboardList, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { GENDER_LABEL, REVIEWER_CATEGORY_LABEL } from '../lib/format.js'
import AccountForm from './AccountForm.jsx'
import AccountStoreBadges from './AccountStoreBadges.jsx'
import AccountTaskModal from './AccountTaskModal.jsx'
import AssignTaskModal from './AssignTaskModal.jsx'

const PLATFORM_BADGE = {
  naver: 'bg-green-100 text-green-700',
  kakao: 'bg-yellow-100 text-yellow-700',
}

const CATEGORY_BADGE = {
  admin: 'bg-purple-100 text-purple-700',
  reviewer: 'bg-gray-100 text-gray-600',
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
  const [expanded, setExpanded] = useState(false)
  const [taskAccount, setTaskAccount] = useState(null)

  return (
    <div className={`rounded-card border bg-white p-4 ${reviewer.is_active ? 'border-gray-200' : 'border-gray-200 opacity-70'}`}>
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
              className={`rounded-pill px-1.5 py-0.5 text-xs font-semibold ${CATEGORY_BADGE[reviewer.category]}`}
            >
              {REVIEWER_CATEGORY_LABEL[reviewer.category]}
            </span>
            <h3 className="font-semibold text-gray-900">{reviewer.name}</h3>
            {reviewer.blog_duplicate && (
              <span
                className="rounded-pill bg-danger-bg px-1.5 py-0.5 text-xs font-semibold text-danger-text"
                title="다른 리뷰어와 블로그 주소가 같습니다 — 같은 사람인지 확인해주세요"
              >
                중복의심
              </span>
            )}
            {reviewer.gender && (
              <span className={`rounded-pill px-1.5 py-0.5 text-xs font-semibold ${GENDER_BADGE[reviewer.gender]}`}>
                {GENDER_LABEL[reviewer.gender]}
              </span>
            )}
            <button
              onClick={() => onToggleActive(reviewer.id, !reviewer.is_active)}
              className={`rounded-pill px-1.5 py-0.5 text-xs font-semibold ${
                reviewer.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {reviewer.is_active ? '활성화' : '비활성화'}
            </button>
          </div>
          {reviewer.memo && <p className="text-sm text-gray-500">{reviewer.memo}</p>}
          {reviewer.contact_info && (
            <p className="text-sm text-gray-600">연락처: {reviewer.contact_info}</p>
          )}
          {reviewer.category === 'experience' && (reviewer.region || reviewer.age_group || reviewer.blog_index) && (
            <p className="text-xs text-gray-500">
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
              className="block text-xs text-brand-600 hover:underline"
            >
              {reviewer.blog_url}
            </a>
          )}
          {reviewer.category === 'experience' && reviewer.email && (
            <p className="text-xs text-gray-500">확인용 이메일: {reviewer.email}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAssigning(true)}
            className="text-gray-400 hover:text-brand-600"
            title="작업 배정"
          >
            <Send size={16} />
          </button>
          <button
            onClick={() => onDeleteReviewer(reviewer.id)}
            className="text-gray-400 hover:text-danger-text"
            title="리뷰어 삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between rounded-btn bg-gray-50 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          <span>계정 {reviewer.accounts.length}개</span>
          <ChevronDown size={14} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>

        {expanded && (
          <div className="mt-2 space-y-3">
            {reviewer.accounts.length === 0 ? (
              <p className="text-sm text-gray-400">등록된 계정이 없습니다</p>
            ) : (
              <div className="overflow-hidden rounded-card border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">플랫폼</th>
                      <th className="px-3 py-2 font-medium">계정</th>
                      <th className="px-3 py-2 font-medium">매장 이력</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {reviewer.accounts.map((account) => (
                      <tr key={account.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 align-top">
                          <span className={`rounded-pill px-1.5 py-0.5 text-xs font-medium ${PLATFORM_BADGE[account.platform]}`}>
                            {account.platform === 'naver' ? '네이버' : '카카오'}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-gray-700">{account.label}</span>
                            {account.profile_url && (
                              <a
                                href={account.profile_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-brand-600 hover:underline"
                              >
                                프로필
                              </a>
                            )}
                            {account.ip_address && (
                              <span className="rounded-pill bg-gray-150 px-1.5 py-0.5 text-[11px] text-gray-600">
                                IP {account.ip_address}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <AccountStoreBadges account={account} />
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setTaskAccount({ ...account, name: reviewer.name })}
                              className="text-gray-400 hover:text-brand-600"
                              title="작업 관리 (배정/결과 링크 입력)"
                            >
                              <ClipboardList size={14} />
                            </button>
                            <button
                              onClick={() => onDeleteAccount(reviewer.id, account.id)}
                              className="text-gray-400 hover:text-danger-text"
                              title="계정 삭제"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <AccountForm onCreate={(data) => onCreateAccount(reviewer.id, data)} />
          </div>
        )}
      </div>

      {assigning && (
        <AssignTaskModal
          reviewer={reviewer}
          onClose={() => setAssigning(false)}
          onAssigned={() => setAssigning(false)}
        />
      )}
      {taskAccount && <AccountTaskModal row={taskAccount} onClose={() => setTaskAccount(null)} />}
    </div>
  )
}

import { Trash2 } from 'lucide-react'
import AccountForm from './AccountForm.jsx'

const PLATFORM_BADGE = {
  naver: 'bg-green-100 text-green-700',
  kakao: 'bg-yellow-100 text-yellow-700',
}

export default function ReviewerCard({
  reviewer,
  onDeleteReviewer,
  onToggleActive,
  onCreateAccount,
  onDeleteAccount,
}) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${reviewer.is_active ? 'border-slate-200' : 'border-slate-200 opacity-70'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">{reviewer.name}</h3>
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
        </div>
        <button
          onClick={() => onDeleteReviewer(reviewer.id)}
          className="text-slate-400 hover:text-red-600"
          title="리뷰어 삭제"
        >
          <Trash2 size={16} />
        </button>
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
            <div className="flex items-center gap-2">
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
            </div>
            <button
              onClick={() => onDeleteAccount(reviewer.id, account.id)}
              className="text-slate-400 hover:text-red-600"
              title="계정 삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <AccountForm onCreate={(data) => onCreateAccount(reviewer.id, data)} />
    </div>
  )
}

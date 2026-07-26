import { Building2, ClipboardList, Settings2, ShieldCheck, Store, Users, Wallet } from 'lucide-react'

const TABS = [
  { id: 'reviewers', label: '리뷰어 관리', icon: Users },
  { id: 'admin-accounts', label: '관리자 계정', icon: ShieldCheck },
  { id: 'stores', label: '매장 관리', icon: Building2 },
  { id: 'targets', label: '캠페인 등록/목록', icon: Store },
  { id: 'tasks', label: '작업 현황', icon: ClipboardList },
  { id: 'settlement', label: '정산 요약', icon: Wallet },
  { id: 'settings', label: '설정', icon: Settings2 },
]

export default function Nav({ active, onChange }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 sm:px-4">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 sm:py-3 ${
            active === id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </nav>
  )
}

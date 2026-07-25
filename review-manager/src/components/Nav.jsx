import { ClipboardList, Settings2, Store, Users, Wallet } from 'lucide-react'

const TABS = [
  { id: 'reviewers', label: '리뷰어 관리', icon: Users },
  { id: 'targets', label: '리뷰 대상 등록', icon: Store },
  { id: 'tasks', label: '작업 현황', icon: ClipboardList },
  { id: 'settlement', label: '정산 요약', icon: Wallet },
  { id: 'settings', label: '설정', icon: Settings2 },
]

export default function Nav({ active, onChange }) {
  return (
    <nav className="flex gap-1 border-b border-slate-200 bg-white px-4">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
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

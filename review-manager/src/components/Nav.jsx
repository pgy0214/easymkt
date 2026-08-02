import { ChevronDown, Settings2, Store, Users, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const GROUPS = [
  {
    id: 'account',
    label: '계정',
    icon: Users,
    children: [
      { id: 'reviewers', label: '리뷰어 관리' },
      { id: 'admin-accounts', label: '관리자 계정' },
    ],
  },
  {
    id: 'campaign',
    label: '캠페인',
    icon: Store,
    children: [
      { id: 'stores', label: '매장정보' },
      { id: 'receipt', label: '영수증 만들기' },
      { id: 'targets', label: '캠페인 등록/목록' },
      { id: 'tasks', label: '작업 현황' },
    ],
  },
]

const FLAT_TABS = [
  { id: 'settlement', label: '정산 요약', icon: Wallet },
  { id: 'settings', label: '설정', icon: Settings2 },
]

export default function Nav({ active, onChange }) {
  const [openGroup, setOpenGroup] = useState(null)
  const navRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenGroup(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav ref={navRef} className="relative flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 sm:px-4">
      {GROUPS.map((group) => {
        const Icon = group.icon
        const isActive = group.children.some((c) => c.id === active)
        const isOpen = openGroup === group.id
        return (
          <div key={group.id} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOpenGroup((prev) => (prev === group.id ? null : group.id))}
              className={`flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 sm:py-3 ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={16} />
              {group.label}
              <ChevronDown size={14} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {isOpen && (
              <div className="absolute left-0 top-full z-20 min-w-[160px] rounded-b border border-slate-200 bg-white py-1 shadow-lg">
                {group.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => {
                      onChange(child.id)
                      setOpenGroup(null)
                    }}
                    className={`block w-full whitespace-nowrap px-3 py-2 text-left text-sm ${
                      active === child.id ? 'bg-blue-50 font-medium text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {FLAT_TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
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

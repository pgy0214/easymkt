import { ChevronDown, Settings2, Store, UserCheck, Users, Wallet } from 'lucide-react'
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
  { id: 'experience', label: '체험단', icon: UserCheck },
  { id: 'settlement', label: '정산 요약', icon: Wallet },
  { id: 'settings', label: '설정', icon: Settings2 },
]

export default function Nav({ active, onChange }) {
  const [openGroup, setOpenGroup] = useState(null)
  const [dropdownPos, setDropdownPos] = useState(null)
  const navRef = useRef(null)
  const buttonRefs = useRef({})

  useEffect(() => {
    function handleClickOutside(e) {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenGroup(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleGroup(groupId) {
    setOpenGroup((prev) => {
      if (prev === groupId) return null
      const rect = buttonRefs.current[groupId]?.getBoundingClientRect()
      if (rect) setDropdownPos({ left: rect.left, top: rect.bottom })
      return groupId
    })
  }

  return (
    // overflow-x-auto here (for the mobile horizontal-scroll tabs) forces the
    // browser to also compute overflow-y as auto, which would clip the dropdown
    // panels below — so the dropdowns use position:fixed (computed from the
    // button's rect) instead of absolute, which escapes that clipping.
    <nav ref={navRef} className="relative flex gap-1 overflow-x-auto border-b border-gray-200 bg-white px-2 sm:px-4">
      {GROUPS.map((group) => {
        const Icon = group.icon
        const isActive = group.children.some((c) => c.id === active)
        const isOpen = openGroup === group.id
        return (
          <div key={group.id} className="relative shrink-0">
            <button
              ref={(el) => (buttonRefs.current[group.id] = el)}
              type="button"
              onClick={() => toggleGroup(group.id)}
              className={`flex items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 sm:py-3 ${
                isActive
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Icon size={16} />
              {group.label}
              <ChevronDown size={14} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {isOpen && dropdownPos && (
              <div
                style={{ left: dropdownPos.left, top: dropdownPos.top }}
                className="fixed z-20 min-w-[160px] rounded-b-card border border-gray-200 bg-white py-1 shadow-lg"
              >
                {group.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => {
                      onChange(child.id)
                      setOpenGroup(null)
                    }}
                    className={`block w-full whitespace-nowrap px-3 py-2 text-left text-sm ${
                      active === child.id ? 'bg-brand-50 font-semibold text-brand-600' : 'text-gray-600 hover:bg-gray-50'
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
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </nav>
  )
}

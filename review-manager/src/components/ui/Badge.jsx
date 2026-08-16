const VARIANT = {
  success: 'bg-success-bg text-success-text',
  warning: 'bg-warning-bg text-warning-text',
  danger: 'bg-danger-bg text-danger-text',
  info: 'bg-info-bg text-info-text',
  neutral: 'bg-gray-150 text-gray-600',
}

// 화면별 분류 색(플랫폼/카테고리/성별 등) — 전역 토큰엔 아직 안 넣고 여기서만 준비
const COLOR_MAP = {
  purple: 'bg-[#F2ECFB] text-[#7C4DE0]',
  pink: 'bg-[#FDECF3] text-[#DB4C86]',
  sky: 'bg-[#E7F5FE] text-[#1C8FD6]',
  rose: 'bg-[#FEECF0] text-[#DB3B5C]',
  yellow: 'bg-[#FFF8DB] text-[#A98600]',
  gray: 'bg-gray-150 text-gray-600',
}

export default function Badge({ variant = 'neutral', color, className = '', children }) {
  const toneClass = color ? COLOR_MAP[color] : VARIANT[variant]

  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold ${toneClass} ${className}`}>
      {children}
    </span>
  )
}

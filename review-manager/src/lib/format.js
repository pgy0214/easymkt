export function formatKRW(amount) {
  if (amount === null || amount === undefined) return '-'
  return `${new Intl.NumberFormat('ko-KR').format(amount)}원`
}

export function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR')
}

export const PLATFORM_LABEL = {
  naver: '네이버영수증',
  kakao: '카카오맵',
}

export const STATUS_LABEL = {
  open: '오픈풀(미배정)',
  claimed: '클레임됨',
  checking_date: '날짜확인중',
  ready: '작업가능',
  completed: '완료',
}

export const BLIND_STATUS_LABEL = {
  unknown: '미확인',
  visible: '정상노출',
  blinded: '블라인드',
}

// index = Python's date.weekday() convention (0=Mon..6=Sun), matches the
// backend's work_days encoding
export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

export function formatWorkDays(days) {
  if (!days || days.length === 0 || days.length === 7) return '매일'
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(',')
}

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

export function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return '무기한'
  const start = startDate ?? '시작일 미지정'
  const end = endDate ?? '종료일 미지정'
  if (startDate && endDate) {
    const days = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1
    return `${start} ~ ${end} (${days}일간)`
  }
  return `${start} ~ ${end}`
}

export function formatWorkDays(days) {
  if (!days || days.length === 0 || days.length === 7) return '매일'
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(',')
}

export const REVIEWER_CATEGORY_LABEL = {
  admin: '관리자',
  reviewer: '리뷰어',
  experience: '체험단',
  press: '기자단',
}

export const GENDER_LABEL = {
  male: '남성',
  female: '여성',
}

// 입력 중인 값에 실시간으로 하이픈을 넣어준다 (000-00-00000, 총 10자리)
export function formatBusinessNumber(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

export const AGE_GROUP_OPTIONS = ['10대', '20대', '30대', '40대', '50대', '60대 이상']

export const REGION_GROUPS = [
  { label: '서울', options: ['서울특별시'] },
  {
    label: '광역시',
    options: [
      '부산광역시',
      '대구광역시',
      '인천광역시',
      '광주광역시',
      '대전광역시',
      '울산광역시',
      '세종특별자치시',
    ],
  },
  {
    label: '도',
    options: [
      '경기도',
      '강원특별자치도',
      '충청북도',
      '충청남도',
      '전북특별자치도',
      '전라남도',
      '경상북도',
      '경상남도',
      '제주특별자치도',
    ],
  },
]

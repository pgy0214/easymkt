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

// <input type="date">가 주는 값(예: "2026-08-09")은 타임존 정보가 없는 "내 지역
// 날짜"다 — 그대로 서버로 보내면 백엔드가 UTC로 오해해서(예: 한국은 UTC+9) 모집기간
// 필터(recruit_start <= now <= recruit_end)가 어긋난다. 하루의 시작/끝 시각을 붙여
// 브라우저 로컬시각으로 해석한 뒤 UTC로 변환해서 보낸다(서버의 utcnow()와 동일한 표기).
export function localDateToUtcNaiveIso(dateStr, endOfDay = false) {
  if (!dateStr) return null
  const time = endOfDay ? 'T23:59:59' : 'T00:00:00'
  return new Date(`${dateStr}${time}`).toISOString().slice(0, 19)
}

// 반대로 서버가 돌려준 값(타임존 표기 없는 UTC 문자열)을 화면에 보여줄 땐 'Z'를 붙여
// UTC로 해석시킨 뒤 로컬 날짜로 변환한다.
export function formatUtcToLocalDate(value) {
  if (!value) return ''
  const date = new Date(value.includes('Z') ? value : `${value}Z`)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const PLATFORM_LABEL = {
  naver: '네이버영수증',
  kakao: '카카오맵',
}

export const CATEGORY_LABEL = {
  admin: '관리자',
  own: '자체계정',
  advertiser: '광고주',
  reviewer: '리뷰어',
  experience: '체험단',
  press: '기자단',
}

export const STATUS_LABEL = {
  open: '미배정',
  claimed: '배정완료',
  checking_date: '날짜확인중',
  ready: '작업가능',
  submitted: '확인대기',
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
  own: '자체계정',
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

// Store.representative_product 같은 "이름 가격원, 이름2 가격2원" 콤마구분 문자열을
// [{name, price}] 배열로 파싱한다 — ProductRowsEditor(매장 대표상품 편집)와
// TargetForm(캠페인 등록시 매장 메뉴 자동입력) 양쪽에서 같은 로직을 써야 한다.
// 단순히 ","로 나누면 "22,000원"처럼 가격 자체에 천단위 콤마가 들어간 경우 "22"와
// "000원"으로 쪼개지는 문제가 있어(실제로 확인함), 문자열 전체에서 "이름 + 공백 +
// 숫자(,숫자)* + 선택적 원 + (,로 이어지거나 끝)" 패턴을 직접 찾는다 — 백엔드
// receipt_generator.parse_representative_product와 동일한 로직.
export function parseProductString(text) {
  if (!text) return []
  const items = []
  for (const match of text.trim().matchAll(/(.+?)\s+(\d+(?:,\d{3})*)\s*원?\s*(?:,\s*|$)/g)) {
    const name = match[1].trim()
    if (name) items.push({ name, price: match[2].replace(/,/g, '') })
  }
  return items
}

// 영수증 캔버스에서 상품명이 단가 칸과 겹치지 않는 실측 안전선 — 백엔드
// receipt_generator.MAX_PRODUCT_NAME_LENGTH와 반드시 같은 값을 유지해야 한다.
export const MAX_PRODUCT_NAME_LENGTH = 12

// maxLength HTML 속성만 쓰면 타이핑이 조용히 막혀서 사용자가 왜 안 눌리는지 모른다 —
// 여기서 직접 길이를 검사해 팝업으로 알려주고 잘라낸다.
export function enforceProductNameLength(value) {
  if (value.length > MAX_PRODUCT_NAME_LENGTH) {
    alert(`상품명은 최대 ${MAX_PRODUCT_NAME_LENGTH}자까지만 입력할 수 있어요 (영수증 이미지에서 단가와 겹치는 걸 막기 위함).`)
    return value.slice(0, MAX_PRODUCT_NAME_LENGTH)
  }
  return value
}

// 체험단 회원가입(Portal.jsx)에서 입력받는 정보와 동일한 옵션을 관리자 쪽에서도
// 그대로 써야 두 경로로 들어온 데이터가 같은 값으로 필터링/비교된다 — 여기 한
// 곳에서만 관리한다.
export const AGE_GROUP_OPTIONS = ['20대', '30대', '40대', '그외']

export const REGION_OPTIONS = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', '대전광역시',
  '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', '충청북도', '충청남도',
  '전북특별자치도', '전라남도', '경상북도', '경상남도', '제주특별자치도',
]

export const BLOG_INDEX_OPTIONS = [
  '전체',
  '준최1', '준최2', '준최3', '준최4', '준최5', '준최6', '준최7',
  '최적1', '최적2', '최적3',
  '최적1+', '최적2+', '최적3+', '최적4+',
  '공식블로그', '인플루언서',
]

export const TOPIC_OPTIONS = [
  '맛집', '여행', '뷰티', '패션', '육아', '리빙/인테리어',
  'IT/전자기기', '자동차', '반려동물', '건강/운동', '문화/공연', '제품후기', '기타',
]

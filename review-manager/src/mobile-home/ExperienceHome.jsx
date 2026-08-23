import { useState } from 'react'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'

const REGIONS = ['전체지역', '서울', '경기', '부산', '대구', '인천', '광주', '대전']

const CATEGORIES = ['전체', '맛집', '뷰티', '생활', '디지털']

const STATUS_BADGE = {
  urgent: { label: '마감임박', variant: 'danger' },
  new: { label: '신규오픈', variant: 'success' },
  closed: { label: '모집마감', variant: 'neutral' },
}

const MOCK_CAMPAIGNS = [
  { id: 1, storeName: '호랑이족발 안양점', region: '경기', category: '맛집', status: 'urgent', applied: 4, capacity: 9 },
  { id: 2, storeName: '헤이데이피트니스 평택고덕점', region: '경기', category: '생활', status: 'new', applied: 1, capacity: 5 },
  { id: 3, storeName: '한양 사당직영점', region: '서울', category: '맛집', status: 'closed', applied: 10, capacity: 10 },
  { id: 4, storeName: '오렌지게스트하우스', region: '서울', category: '생활', status: 'new', applied: 2, capacity: 6 },
  { id: 5, storeName: '갑순네돌산갓김치', region: '전남', category: '맛집', status: 'urgent', applied: 7, capacity: 8 },
  { id: 6, storeName: '신짬', region: '부산', category: '맛집', status: 'new', applied: 0, capacity: 10 },
]

export default function ExperienceHome({ onStartLogin }) {
  const [region, setRegion] = useState(REGIONS[0])
  const [category, setCategory] = useState(CATEGORIES[0])

  const filtered = MOCK_CAMPAIGNS.filter(
    (c) => (region === '전체지역' || c.region === region) && (category === '전체' || c.category === category),
  )

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-1.5">
          <img src="/logo.svg" alt="" className="h-6 w-6" />
          <span className="text-base font-bold text-gray-900">이지리뷰</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="hidden sm:inline">체험단 캠페인</span>
          <span className="hidden sm:inline">카테고리</span>
          <Button variant="primary" size="sm" onClick={onStartLogin}>
            로그인
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="rounded-card bg-brand-500 p-8">
          <p className="text-2xl font-bold leading-snug text-white">
            궁금했던 그곳,
            <br />
            무료로 체험해보세요
          </p>
          <p className="mt-2 text-sm text-brand-100">마음에 드는 매장을 골라 체험하고 솔직한 후기를 남겨주세요</p>
          <Button
            variant="outline"
            className="mt-4 border-none bg-white text-brand-700 hover:bg-brand-50"
            onClick={onStartLogin}
          >
            체험단 둘러보기
          </Button>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              className={`shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                region === r ? 'bg-brand-500 text-white' : 'border border-gray-200 bg-white text-gray-700'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-4 border-b border-gray-200 text-sm text-gray-500">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`-mb-px border-b-2 pb-2 font-medium ${
                category === c ? 'border-brand-500 text-gray-900' : 'border-transparent'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-gray-400">
              조건에 맞는 체험단이 없어요. 다른 지역이나 카테고리를 선택해보세요.
            </p>
          )}
          {filtered.map((c) => {
            const status = STATUS_BADGE[c.status]
            return (
              <button
                key={c.id}
                type="button"
                onClick={onStartLogin}
                className="overflow-hidden rounded-card bg-white text-left disabled:opacity-55"
                disabled={c.status === 'closed'}
              >
                <div className="h-20 bg-brand-100" />
                <div className="p-3">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <p className="mt-1.5 truncate text-sm font-semibold text-gray-900">{c.storeName}</p>
                  <p className="text-xs text-gray-500">
                    신청 {c.applied}/{c.capacity}명
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}

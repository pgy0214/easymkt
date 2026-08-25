import { BLIND_STATUS_LABEL, PLATFORM_LABEL, REVIEWER_CATEGORY_LABEL, STATUS_LABEL } from '../lib/format.js'

export default function TaskFilters({ filters, onChange, reviewers, stores = [] }) {
  function set(key, value) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-gray-200 bg-white p-3">
      <input
        type="text"
        lang="ko"
        value={filters.search}
        onChange={(e) => set('search', e.target.value)}
        placeholder="검색 (작업번호/리뷰어/연락처/계정/링크)"
        className="w-64 rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
      />

      <select
        value={filters.store_id}
        onChange={(e) => set('store_id', e.target.value)}
        className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
      >
        <option value="">전체 매장</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <select
        value={filters.reviewer_id}
        onChange={(e) => set('reviewer_id', e.target.value)}
        className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
      >
        <option value="">전체 리뷰어</option>
        {reviewers.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>

      <select
        value={filters.reviewer_category}
        onChange={(e) => set('reviewer_category', e.target.value)}
        className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
      >
        <option value="">전체 카테고리</option>
        {Object.entries(REVIEWER_CATEGORY_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={filters.platform}
        onChange={(e) => set('platform', e.target.value)}
        className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
      >
        <option value="">전체 플랫폼</option>
        {Object.entries(PLATFORM_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={filters.status}
        onChange={(e) => set('status', e.target.value)}
        className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
      >
        <option value="">전체 상태</option>
        {Object.entries(STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={filters.blind_status}
        onChange={(e) => set('blind_status', e.target.value)}
        className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
      >
        <option value="">전체 블라인드상태</option>
        {Object.entries(BLIND_STATUS_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={filters.settlement_status}
        onChange={(e) => set('settlement_status', e.target.value)}
        className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
      >
        <option value="">전체 정산상태</option>
        <option value="unpaid">미정산</option>
        <option value="paid">정산완료</option>
      </select>
    </div>
  )
}

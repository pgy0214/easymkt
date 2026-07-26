import { Search, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { GENDER_LABEL, REVIEWER_CATEGORY_LABEL } from '../lib/format.js'
import ReviewerCard from './ReviewerCard.jsx'
import ReviewerForm from './ReviewerForm.jsx'

const MAX_VISIBLE = 50

export default function ReviewerManager() {
  const [reviewers, setReviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [ageGroupFilter, setAgeGroupFilter] = useState('')
  const [search, setSearch] = useState('')
  const fileInputRef = useRef(null)

  async function refresh() {
    setLoading(true)
    try {
      setReviewers(await api.getReviewers())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreateReviewer(data) {
    const reviewer = await api.createReviewer(data)
    setReviewers((prev) => [...prev, reviewer])
  }

  async function handleDeleteReviewer(id) {
    if (!confirm('이 리뷰어를 삭제할까요?')) return
    try {
      await api.deleteReviewer(id)
      setReviewers((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleCreateAccount(reviewerId, data) {
    const account = await api.createAccount(reviewerId, data)
    setReviewers((prev) =>
      prev.map((r) => (r.id === reviewerId ? { ...r, accounts: [...r.accounts, account] } : r)),
    )
  }

  async function handleToggleActive(id, isActive) {
    try {
      const updated = await api.updateReviewer(id, { is_active: isActive })
      setReviewers((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDeleteAccount(reviewerId, accountId) {
    if (!confirm('이 계정을 삭제할까요?')) return
    try {
      await api.deleteAccount(accountId)
      setReviewers((prev) =>
        prev.map((r) =>
          r.id === reviewerId
            ? { ...r, accounts: r.accounts.filter((a) => a.id !== accountId) }
            : r,
        ),
      )
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await api.importReviewers(file)
      setImportResult(result)
      await refresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const regionOptions = useMemo(
    () => [...new Set(reviewers.map((r) => r.region).filter(Boolean))].sort(),
    [reviewers],
  )
  const ageGroupOptions = useMemo(
    () => [...new Set(reviewers.map((r) => r.age_group).filter(Boolean))].sort(),
    [reviewers],
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return reviewers.filter((r) => {
      if (statusFilter === 'active' && !r.is_active) return false
      if (statusFilter === 'inactive' && r.is_active) return false
      if (categoryFilter && r.category !== categoryFilter) return false
      if (genderFilter && r.gender !== genderFilter) return false
      if (regionFilter && r.region !== regionFilter) return false
      if (ageGroupFilter && r.age_group !== ageGroupFilter) return false
      if (query && !r.name.toLowerCase().includes(query) && !r.contact_info?.includes(query)) {
        return false
      }
      return true
    })
  }, [reviewers, statusFilter, categoryFilter, genderFilter, regionFilter, ageGroupFilter, search])

  const visible = filtered.slice(0, MAX_VISIBLE)

  return (
    <div className="space-y-4">
      <ReviewerForm onCreate={handleCreateReviewer} />

      <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileSelected}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          <Upload size={14} />
          {importing ? '업로드 중...' : '엑셀/CSV로 리뷰어 일괄 등록'}
        </button>
        <span className="text-xs text-slate-400">
          '리뷰어' 탭 기준: 이름/연락처 컬럼이 있는 .xlsx 또는 .csv 파일 (신규 등록은 연락불가 상태로 시작)
        </span>
        {importResult && (
          <span className="ml-auto text-xs text-slate-600">
            신규 {importResult.created}건 · 중복건너뜀 {importResult.skipped_duplicate}건 ·
            이름없음 {importResult.skipped_invalid}건
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">
          전체 {reviewers.length}명 · 연락가능 {reviewers.filter((r) => r.is_active).length}명
        </span>
        <div className="relative ml-auto">
          <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름/연락처 검색"
            className="w-48 rounded border border-slate-300 py-1 pl-7 pr-2 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="all">전체 보기</option>
          <option value="active">연락가능만</option>
          <option value="inactive">연락불가만</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">전체 카테고리</option>
          {Object.entries(REVIEWER_CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">전체 성별</option>
          {Object.entries(GENDER_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">전체 지역</option>
          {regionOptions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
        <select
          value={ageGroupFilter}
          onChange={(e) => setAgeGroupFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">전체 연령대</option>
          {ageGroupOptions.map((age) => (
            <option key={age} value={age}>
              {age}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          성별/지역/연령대는 체험단에만 적용됩니다
        </span>
      </div>

      {filtered.length > MAX_VISIBLE && (
        <p className="text-xs text-amber-600">
          조건에 맞는 {filtered.length}명 중 {MAX_VISIBLE}명만 표시 중입니다. 검색으로 좁혀보세요.
        </p>
      )}

      <div className="space-y-3">
        {visible.map((reviewer) => (
          <ReviewerCard
            key={reviewer.id}
            reviewer={reviewer}
            onDeleteReviewer={handleDeleteReviewer}
            onToggleActive={handleToggleActive}
            onCreateAccount={handleCreateAccount}
            onDeleteAccount={handleDeleteAccount}
          />
        ))}
      </div>
    </div>
  )
}

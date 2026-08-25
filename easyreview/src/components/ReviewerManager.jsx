import { Download, MessageSquare, Search, Send, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { AGE_GROUP_OPTIONS, GENDER_LABEL, REGION_OPTIONS, REVIEWER_CATEGORY_LABEL, TOPIC_OPTIONS } from '../lib/format.js'
import BulkAssignModal from './BulkAssignModal.jsx'
import BulkMessageModal from './BulkMessageModal.jsx'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'
import Pagination from './Pagination.jsx'
import ReviewerCard from './ReviewerCard.jsx'
import ReviewerForm from './ReviewerForm.jsx'

const REVIEWER_TEMPLATE = { filename: '리뷰어_일괄등록_양식.csv', headers: ['이름', '연락처', '메모'] }
const EXPERIENCE_TEMPLATE = {
  filename: '체험단_일괄등록_양식.csv',
  headers: ['이름', '연락처', '지역', '블로그주소', '지수', '연령대', '성별', '메모'],
}

function downloadTemplate({ filename, headers }) {
  // leading BOM so Excel opens the Korean headers as UTF-8 instead of guessing ANSI
  const csv = '﻿' + headers.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ReviewerManager() {
  const [reviewers, setReviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importCategory, setImportCategory] = useState('reviewer')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [ageGroupFilter, setAgeGroupFilter] = useState('')
  const [topicFilter, setTopicFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [stores, setStores] = useState([])
  const [storeFilter, setStoreFilter] = useState('')
  const [eligibleReviewerIds, setEligibleReviewerIds] = useState(null)
  const [checkingEligibility, setCheckingEligibility] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const [bulkMessaging, setBulkMessaging] = useState(false)
  const fileInputRef = useRef(null)

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    api.getStores().then(setStores).catch(() => {})
  }, [])

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === Number(storeFilter)) ?? null,
    [stores, storeFilter],
  )

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
      const result = await api.importReviewers(file, importCategory)
      setImportResult(result)
      await refresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const nonAdminReviewers = useMemo(
    () => reviewers.filter((r) => r.category !== 'own' && r.category !== 'admin' && r.category !== 'advertiser'),
    [reviewers],
  )

  // 카테고리/성별/지역/연령대/검색까지 먼저 적용한 결과 — 매장 필터는 이 결과 위에 마지막으로
  // 얹는다("체험단+여성+20대"까지 고른 다음 매장을 고르면 그 조건의 리뷰어 중 작업 가능한
  // 사람만 남도록). 쿨다운 조회 대상도 이 목록으로 좁혀서 불필요한 API 호출을 줄인다.
  const baseFiltered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return reviewers.filter((r) => {
      // 자체보유계정은 별도의 "관리자 계정" 탭에서, 대시보드 관리자는 회원관리에서, 광고주는 광고주 포털에서 관리
      if (r.category === 'own' || r.category === 'admin' || r.category === 'advertiser') return false
      if (statusFilter === 'active' && !r.is_active) return false
      if (statusFilter === 'inactive' && r.is_active) return false
      if (categoryFilter && r.category !== categoryFilter) return false
      if (genderFilter && r.gender !== genderFilter) return false
      if (regionFilter && r.region !== regionFilter) return false
      if (ageGroupFilter && r.age_group !== ageGroupFilter) return false
      if (topicFilter && !r.topics?.split(',').includes(topicFilter)) return false
      if (query && !r.name.toLowerCase().includes(query) && !r.contact_info?.includes(query)) {
        return false
      }
      return true
    })
  }, [reviewers, statusFilter, categoryFilter, genderFilter, regionFilter, ageGroupFilter, topicFilter, search])

  useEffect(() => {
    if (!selectedStore) {
      setEligibleReviewerIds(null)
      return
    }
    let cancelled = false
    const candidates = []
    for (const r of baseFiltered) {
      for (const a of r.accounts) {
        if (a.platform === selectedStore.platform) candidates.push({ reviewerId: r.id, accountId: a.id })
      }
    }
    setCheckingEligibility(true)
    Promise.all(candidates.map((c) => api.getAccountStoreHistory(c.accountId)))
      .then((results) => {
        if (cancelled) return
        const eligible = new Set()
        results.forEach((history, i) => {
          const entry = history.find((h) => h.store_id === selectedStore.id)
          if (!entry || entry.is_eligible_now) eligible.add(candidates[i].reviewerId)
        })
        setEligibleReviewerIds(eligible)
      })
      .finally(() => {
        if (!cancelled) setCheckingEligibility(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, baseFiltered])

  const filtered = useMemo(() => {
    if (!eligibleReviewerIds) return baseFiltered
    return baseFiltered.filter((r) => eligibleReviewerIds.has(r.id))
  }, [baseFiltered, eligibleReviewerIds])

  const selectedReviewers = useMemo(
    () => reviewers.filter((r) => selectedIds.has(r.id)),
    [reviewers, selectedIds],
  )

  useEffect(() => {
    setPage(1)
  }, [
    statusFilter,
    categoryFilter,
    genderFilter,
    regionFilter,
    ageGroupFilter,
    topicFilter,
    search,
    storeFilter,
    pageSize,
  ])

  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-4">
      <ReviewerForm onCreate={handleCreateReviewer} />

      <Card padding="sm" className="flex flex-wrap items-center gap-2 border-dashed">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileSelected}
          className="hidden"
        />
        <select
          value={importCategory}
          onChange={(e) => setImportCategory(e.target.value)}
          className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
          <option value="reviewer">리뷰어</option>
          <option value="experience">체험단</option>
        </select>
        <Button onClick={() => fileInputRef.current?.click()} disabled={importing} variant="secondary">
          <Upload size={14} />
          {importing ? '업로드 중...' : '엑셀/CSV로 일괄 등록'}
        </Button>
        <Button
          onClick={() =>
            downloadTemplate(importCategory === 'experience' ? EXPERIENCE_TEMPLATE : REVIEWER_TEMPLATE)
          }
          variant="outline"
        >
          <Download size={14} />
          샘플 양식 다운로드
        </Button>
        <span className="text-xs text-gray-400">
          이름/연락처(+체험단은 지역/블로그주소/지수/연령대/성별)/메모 컬럼이 있는 .xlsx 또는
          .csv 파일 (신규 등록은 비활성화 상태로 시작)
        </span>
        {importResult && (
          <span className="ml-auto text-xs text-gray-600">
            신규 {importResult.created}건 · 중복건너뜀 {importResult.skipped_duplicate}건 ·
            이름없음 {importResult.skipped_invalid}건
          </span>
        )}
      </Card>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">
          전체 {nonAdminReviewers.length}명 · 활성화 {nonAdminReviewers.filter((r) => r.is_active).length}명
        </span>
        <div className="relative ml-auto">
          <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            lang="ko"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름/연락처 검색"
            className="w-full max-w-[16rem] rounded-btn border border-gray-300 py-1 pl-7 pr-2 text-sm sm:w-48"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
          <option value="all">전체 보기</option>
          <option value="active">활성화만</option>
          <option value="inactive">비활성화만</option>
        </select>
      </div>
      <p className="text-xs text-gray-400">활성화가 된 경우에만 리뷰어가 작업 가능합니다.</p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
          <option value="">전체 카테고리</option>
          {Object.entries(REVIEWER_CATEGORY_LABEL)
            .filter(([value]) => value !== 'admin' && value !== 'own')
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
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
          className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
          <option value="">전체 지역</option>
          {REGION_OPTIONS.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
        <select
          value={ageGroupFilter}
          onChange={(e) => setAgeGroupFilter(e.target.value)}
          className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
          <option value="">전체 연령대</option>
          {AGE_GROUP_OPTIONS.map((age) => (
            <option key={age} value={age}>
              {age}
            </option>
          ))}
        </select>
        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
          <option value="">전체 주제</option>
          {TOPIC_OPTIONS.map((topic) => (
            <option key={topic} value={topic}>
              {topic}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-400">
          성별/지역/연령대/주제는 체험단에만 적용됩니다
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={storeFilter}
          onChange={(e) => setStoreFilter(e.target.value)}
          className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
          <option value="">작업 매장으로 필터링 안 함</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              [{s.platform === 'naver' ? '네이버' : '카카오'}] {s.name}
            </option>
          ))}
        </select>
        {checkingEligibility && (
          <span className="text-xs text-gray-400">작업가능 여부 확인 중...</span>
        )}
        {selectedStore && !checkingEligibility && (
          <span className="text-xs text-gray-500">
            위 조건에 맞으면서 {selectedStore.name}에서 지금 작업 가능한 계정을 가진 리뷰어만
            표시 중
          </span>
        )}
        {selectedIds.size > 0 && (
          <>
            <span className="text-xs text-gray-500">선택 {selectedIds.size}명</span>
            <Button onClick={() => setBulkAssigning(true)} variant="ghost" tone="blue" size="sm">
              <Send size={12} />
              선택 작업 배분
            </Button>
            <Button onClick={() => setBulkMessaging(true)} variant="ghost" tone="emerald" size="sm">
              <MessageSquare size={12} />
              선택 메시지 발송
            </Button>
          </>
        )}
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      {visible.length > 0 && (
        <label className="flex items-center gap-1.5 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={visible.every((r) => selectedIds.has(r.id))}
            onChange={() =>
              setSelectedIds((prev) => {
                const allSelected = visible.every((r) => prev.has(r.id))
                const next = new Set(prev)
                visible.forEach((r) => {
                  if (allSelected) next.delete(r.id)
                  else next.add(r.id)
                })
                return next
              })
            }
          />
          현재 페이지 전체 선택
        </label>
      )}

      <div className="space-y-3">
        {visible.map((reviewer) => (
          <ReviewerCard
            key={reviewer.id}
            reviewer={reviewer}
            selected={selectedIds.has(reviewer.id)}
            onToggleSelect={toggleSelected}
            onDeleteReviewer={handleDeleteReviewer}
            onToggleActive={handleToggleActive}
            onCreateAccount={handleCreateAccount}
            onDeleteAccount={handleDeleteAccount}
          />
        ))}
      </div>

      {filtered.length > pageSize && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}

      {bulkAssigning && (
        <BulkAssignModal
          entities={selectedReviewers}
          getDisplayName={(reviewer) => reviewer.name}
          resolveAccount={(reviewer, platform) =>
            reviewer.accounts.find((a) => a.platform === platform) ?? null
          }
          unitLabel="명"
          onClose={() => setBulkAssigning(false)}
          onDone={refresh}
        />
      )}
      {bulkMessaging && (
        <BulkMessageModal reviewers={selectedReviewers} onClose={() => setBulkMessaging(false)} />
      )}
    </div>
  )
}

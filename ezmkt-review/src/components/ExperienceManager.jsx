import { Download, ExternalLink, FileText, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { GENDER_LABEL } from '../lib/format.js'
import Badge from './ui/Badge.jsx'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'
import CopyButton from './CopyButton.jsx'
import ReviewerForm from './ReviewerForm.jsx'

const TEMPLATE = {
  filename: '체험단_일괄등록_양식.csv',
  headers: ['타임스탬프', '이름', '연락처', '연령대', '성별', '지역', '블로그주소', '지수'],
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

const STATUS_LABEL = { pending: '대기중', approved: '승인됨', rejected: '거절됨' }
const STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'danger' }

export default function ExperienceManager() {
  const [reviewers, setReviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [recentPosts, setRecentPosts] = useState({})
  const fileInputRef = useRef(null)

  async function refresh() {
    setLoading(true)
    try {
      const all = await api.getReviewers()
      setReviewers(all.filter((r) => r.category === 'experience'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreateReviewer(data) {
    await api.createReviewer(data)
    await refresh()
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await api.importReviewers(file, 'experience')
      setImportResult(result)
      await refresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleStatusChange(id, status) {
    try {
      const updated = await api.updateReviewer(id, { application_status: status })
      setReviewers((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleFetchRecentPosts(id) {
    setRecentPosts((prev) => ({ ...prev, [id]: { loading: true } }))
    try {
      const posts = await api.fetchRecentPosts(id)
      setRecentPosts((prev) => ({ ...prev, [id]: { loading: false, posts } }))
    } catch (err) {
      setRecentPosts((prev) => ({ ...prev, [id]: { loading: false, error: err.message } }))
    }
  }

  const pendingCount = useMemo(
    () => reviewers.filter((r) => (r.application_status ?? 'pending') === 'pending').length,
    [reviewers],
  )
  const approvedCount = useMemo(
    () => reviewers.filter((r) => r.application_status === 'approved').length,
    [reviewers],
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Card padding="sm" className="flex-1 text-center">
          <p className="text-xs text-gray-500">신청 대기</p>
          <p className="text-xl font-semibold text-warning-text">{pendingCount}</p>
        </Card>
        <Card padding="sm" className="flex-1 text-center">
          <p className="text-xs text-gray-500">승인됨</p>
          <p className="text-xl font-semibold text-success-text">{approvedCount}</p>
        </Card>
      </div>

      <ReviewerForm onCreate={handleCreateReviewer} fixedCategory="experience" />

      <Card padding="sm" className="flex flex-wrap items-center gap-2 border-dashed">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileSelected}
          className="hidden"
        />
        <Button onClick={() => fileInputRef.current?.click()} disabled={importing} variant="secondary">
          <Upload size={14} />
          {importing ? '업로드 중...' : '엑셀/CSV로 일괄 등록'}
        </Button>
        <Button onClick={() => downloadTemplate(TEMPLATE)} variant="outline">
          <Download size={14} />
          샘플 양식 다운로드
        </Button>
        <span className="text-xs text-gray-400">
          타임스탬프/이름/연락처/연령대/성별/지역/블로그주소/지수 컬럼이 있는 .xlsx 또는 .csv 파일
        </span>
        {importResult && (
          <span className="ml-auto text-xs text-gray-600">
            신규 {importResult.created}건 · 중복건너뜀 {importResult.skipped_duplicate}건 ·
            이름없음 {importResult.skipped_invalid}건
          </span>
        )}
      </Card>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {!loading && reviewers.length === 0 && (
        <p className="text-sm text-gray-400">등록된 체험단 지원자가 없습니다</p>
      )}

      <div className="space-y-3">
        {reviewers.map((r) => (
          <ExperienceCard
            key={r.id}
            reviewer={r}
            recentPosts={recentPosts[r.id]}
            onFetchRecentPosts={() => handleFetchRecentPosts(r.id)}
            onStatusChange={(status) => handleStatusChange(r.id, status)}
          />
        ))}
      </div>
    </div>
  )
}

function ExperienceCard({ reviewer, recentPosts, onFetchRecentPosts, onStatusChange }) {
  const status = reviewer.application_status ?? 'pending'

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-gray-800">{reviewer.name}</span>
            {reviewer.age_group && <span className="text-xs text-gray-500">{reviewer.age_group}</span>}
            {reviewer.gender && (
              <span className="text-xs text-gray-500">{GENDER_LABEL[reviewer.gender]}</span>
            )}
            {reviewer.region && <span className="text-xs text-gray-500">· {reviewer.region}</span>}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            {reviewer.contact_info}
            <CopyButton value={reviewer.contact_info} label="연락처" />
          </div>
          {reviewer.blog_url && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <a
                href={reviewer.blog_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-brand-600 hover:underline"
              >
                {reviewer.blog_url}
                <ExternalLink size={11} />
              </a>
              <a
                href="https://blogdex.space/lookup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
              >
                블덱스 바로가기
              </a>
              {reviewer.blog_index && <Badge variant="neutral">{reviewer.blog_index}</Badge>}
            </div>
          )}
          {reviewer.applied_at && (
            <p className="mt-1 text-xs text-gray-400">
              신청일 {new Date(reviewer.applied_at).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {reviewer.blog_url && (
          <Button size="sm" variant="outline" onClick={onFetchRecentPosts} disabled={recentPosts?.loading}>
            <FileText size={12} />
            {recentPosts?.loading ? '불러오는 중...' : '최근글 10개'}
          </Button>
        )}
        {status === 'pending' && (
          <>
            <Button size="sm" variant="ghost" tone="emerald" onClick={() => onStatusChange('approved')}>
              승인
            </Button>
            <Button size="sm" variant="danger" onClick={() => onStatusChange('rejected')}>
              거절
            </Button>
          </>
        )}
      </div>

      {recentPosts?.error && <p className="mt-1 text-xs text-danger-text">{recentPosts.error}</p>}
      {recentPosts?.posts && (
        <ul className="mt-2 space-y-1 rounded-card bg-gray-50 p-2 text-xs text-gray-600">
          {recentPosts.posts.length === 0 && <li className="text-gray-400">게시글이 없습니다</li>}
          {recentPosts.posts.map((p, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">{p.title}</span>
              <span className="shrink-0 text-gray-400">{p.posted_date ?? '-'}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

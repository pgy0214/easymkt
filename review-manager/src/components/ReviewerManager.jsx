import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import ReviewerCard from './ReviewerCard.jsx'
import ReviewerForm from './ReviewerForm.jsx'

export default function ReviewerManager() {
  const [reviewers, setReviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
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
    await api.createReviewer(data)
    await refresh()
  }

  async function handleDeleteReviewer(id) {
    if (!confirm('이 리뷰어를 삭제할까요?')) return
    try {
      await api.deleteReviewer(id)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleCreateAccount(reviewerId, data) {
    await api.createAccount(reviewerId, data)
    await refresh()
  }

  async function handleToggleActive(id, isActive) {
    try {
      await api.updateReviewer(id, { is_active: isActive })
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDeleteAccount(accountId) {
    if (!confirm('이 계정을 삭제할까요?')) return
    try {
      await api.deleteAccount(accountId)
      await refresh()
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="ml-auto rounded border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="all">전체 보기</option>
          <option value="active">연락가능만</option>
          <option value="inactive">연락불가만</option>
        </select>
      </div>

      <div className="space-y-3">
        {reviewers
          .filter((r) => {
            if (statusFilter === 'active') return r.is_active
            if (statusFilter === 'inactive') return !r.is_active
            return true
          })
          .map((reviewer) => (
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

import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import ReviewerCard from './ReviewerCard.jsx'

const EMPTY = { name: '', memo: '', contact_info: '' }

export default function AdminAccountManager() {
  const [reviewers, setReviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const all = await api.getReviewers()
      setReviewers(all.filter((r) => r.category === 'admin'))
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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    try {
      const reviewer = await api.createReviewer({
        category: 'admin',
        name: form.name.trim(),
        memo: form.memo.trim() || null,
        contact_info: form.contact_info.trim() || null,
      })
      setReviewers((prev) => [...prev, reviewer])
      setForm(EMPTY)
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteReviewer(id) {
    if (!confirm('이 관리자 계정을 삭제할까요?')) return
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        여기 등록된 계정은 리뷰어가 아니라 우리(회사)가 직접 소유한 계정입니다. "리뷰어 관리"
        목록에는 나타나지 않습니다.
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="block text-xs text-slate-500">이름</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">메모</label>
          <input
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            className="w-40 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">연락수단</label>
          <input
            value={form.contact_info}
            onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
            className="w-56 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={14} />
          관리자 계정 추가
        </button>
      </form>

      {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {reviewers.map((reviewer) => (
          <ReviewerCard
            key={reviewer.id}
            reviewer={reviewer}
            onDeleteReviewer={handleDeleteReviewer}
            onToggleActive={handleToggleActive}
            onCreateAccount={handleCreateAccount}
            onDeleteAccount={handleDeleteAccount}
          />
        ))}
        {!loading && reviewers.length === 0 && (
          <p className="text-sm text-slate-400">등록된 관리자 계정이 없습니다</p>
        )}
      </div>
    </div>
  )
}

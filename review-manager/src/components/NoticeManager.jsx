import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { API_ORIGIN, noticeApi } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import Badge from './ui/Badge.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'

const EMPTY_NOTICE = { title: '', content: '', display_order: 0, is_active: true }

export default function NoticeManager() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editTarget, setEditTarget] = useState(null) // null = closed, {} = new, notice = editing
  const [form, setForm] = useState(EMPTY_NOTICE)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const fileInputRef = useRef(null)
  const uploadTargetId = useRef(null)

  function toggleExpanded(noticeId) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(noticeId)) next.delete(noticeId)
      else next.add(noticeId)
      return next
    })
  }

  function refresh() {
    setLoading(true)
    noticeApi
      .list()
      .then(setNotices)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  function openCreate() {
    setForm(EMPTY_NOTICE)
    setFormError(null)
    setEditTarget({})
  }

  function openEdit(notice) {
    setForm({
      title: notice.title,
      content: notice.content || '',
      display_order: notice.display_order,
      is_active: notice.is_active,
    })
    setFormError(null)
    setEditTarget(notice)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      if (editTarget?.id) {
        const updated = await noticeApi.update(editTarget.id, form)
        setNotices((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      } else {
        const created = await noticeApi.create(form)
        setNotices((prev) => [created, ...prev])
      }
      setEditTarget(null)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(notice) {
    if (!confirm(`"${notice.title}" 공지사항을 삭제할까요?`)) return
    try {
      await noticeApi.delete(notice.id)
      setNotices((prev) => prev.filter((n) => n.id !== notice.id))
    } catch (err) {
      alert(err.message)
    }
  }

  function triggerImageUpload(noticeId) {
    uploadTargetId.current = noticeId
    fileInputRef.current?.click()
  }

  async function handleImageFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !uploadTargetId.current) return
    setUploadingId(uploadTargetId.current)
    try {
      const updated = await noticeApi.uploadImage(uploadTargetId.current, file)
      setNotices((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
    } catch (err) {
      alert(err.message)
    } finally {
      setUploadingId(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">불러오는 중...</p>
  if (error) return <p className="text-sm text-danger-text">{error}</p>

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">공지사항 관리</h2>
          <p className="text-xs text-gray-400">광고주센터 등에 노출될 공지사항을 관리합니다</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} className="mr-1 inline" />
          공지사항 추가
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileChange}
      />

      {notices.length === 0 && <p className="text-sm text-gray-400">등록된 공지사항이 없습니다.</p>}

      <div className="space-y-2">
        {notices.map((n) => {
          const expanded = expandedIds.has(n.id)
          return (
            <div key={n.id} className="rounded-card border border-gray-200 bg-white p-3">
              <button
                type="button"
                onClick={() => toggleExpanded(n.id)}
                className="flex w-full items-start justify-between gap-2 text-left"
              >
                <div className="flex items-start gap-1.5">
                  {expanded ? (
                    <ChevronDown size={16} className="mt-0.5 shrink-0 text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-800">{n.title}</span>
                      <Badge variant={n.is_active ? 'success' : 'neutral'}>{n.is_active ? '노출중' : '숨김'}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">{formatDateTime(n.created_at)} · 순서 {n.display_order}</p>
                  </div>
                </div>
              </button>
              {expanded && (
                <div className="mt-2 pl-6">
                  {n.content && <p className="whitespace-pre-line text-sm text-gray-600">{n.content}</p>}
                  {n.image_path && (
                    <img src={`${API_ORIGIN}${n.image_path}`} alt={n.title} className="mt-2 max-h-48 rounded-btn object-cover" />
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => triggerImageUpload(n.id)}
                      disabled={uploadingId === n.id}
                      className="text-xs text-brand-600 hover:underline disabled:opacity-50"
                    >
                      {uploadingId === n.id ? '업로드 중...' : '이미지 업로드'}
                    </button>
                    <button onClick={() => openEdit(n)} className="text-xs text-brand-600 hover:underline">
                      수정
                    </button>
                    <button onClick={() => handleDelete(n)} className="text-xs text-danger-text hover:underline">
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)}>
        <h3 className="mb-3 font-semibold text-gray-800">{editTarget?.id ? '공지사항 수정' : '공지사항 추가'}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500">제목</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">내용</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              rows={4}
              className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500">노출 순서</label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((prev) => ({ ...prev, display_order: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
            <label className="flex items-center gap-1.5 pt-4 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              노출
            </label>
          </div>
          {formError && <p className="text-sm text-danger-text">{formError}</p>}
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            {submitting ? '저장 중...' : '저장'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}

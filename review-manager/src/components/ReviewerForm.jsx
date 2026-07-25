import { Plus } from 'lucide-react'
import { useState } from 'react'

const EMPTY = { name: '', memo: '', contact_info: '' }

export default function ReviewerForm({ onCreate }) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({
        name: form.name.trim(),
        memo: form.memo.trim() || null,
        contact_info: form.contact_info.trim() || null,
      })
      setForm(EMPTY)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
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
        <label className="block text-xs text-slate-500">연락수단 (카톡ID/전화번호 등)</label>
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
        리뷰어 추가
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  )
}

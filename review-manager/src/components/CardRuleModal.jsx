import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

const EMPTY = { card_prefix_1: '', card_prefix_2: '', approval_prefix: '', acquirer: '', card_type: '' }

export default function CardRuleModal({ onClose }) {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function refresh() {
    setLoading(true)
    try {
      setRules(await api.getCardRules())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    const { card_prefix_1, card_prefix_2, approval_prefix, acquirer, card_type } = form
    if (!card_prefix_1.trim() || !card_prefix_2.trim() || !approval_prefix.trim() || !acquirer.trim() || !card_type.trim()) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await api.createCardRule({
        card_prefix_1: card_prefix_1.trim(),
        card_prefix_2: card_prefix_2.trim(),
        approval_prefix: approval_prefix.trim(),
        acquirer: acquirer.trim(),
        card_type: card_type.trim(),
      })
      setRules((prev) => [...prev, created])
      setForm(EMPTY)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('이 카드정보를 삭제할까요?')) return
    try {
      await api.deleteCardRule(id)
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">영수증 카드정보 관리</h3>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-600">
            닫기
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          영수증 이미지를 만들 때 이 목록에서 하나를 무작위로 골라 카드번호/승인번호/매입사명/카드종류를
          채웁니다. 승인번호는 입력한 앞자리 뒤에 8자리가 되도록 랜덤 숫자를 붙입니다 (예: "8" → 8로
          시작하는 8자리 숫자).
        </p>

        <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-slate-50 p-3">
          <div>
            <label className="block text-xs text-slate-500">카드번호 앞 4자리</label>
            <input
              value={form.card_prefix_1}
              onChange={(e) => setForm({ ...form, card_prefix_1: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="4678"
              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">카드번호 다음 4자리</label>
            <input
              value={form.card_prefix_2}
              onChange={(e) => setForm({ ...form, card_prefix_2: e.target.value.replace(/\D/g, '').slice(0, 4) })}
              placeholder="5600"
              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">승인번호 앞자리</label>
            <input
              value={form.approval_prefix}
              onChange={(e) => setForm({ ...form, approval_prefix: e.target.value.replace(/\D/g, '').slice(0, 7) })}
              placeholder="8"
              className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">매입사명</label>
            <input
              value={form.acquirer}
              onChange={(e) => setForm({ ...form, acquirer: e.target.value })}
              placeholder="우리"
              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">카드종류</label>
            <input
              value={form.card_type}
              onChange={(e) => setForm({ ...form, card_type: e.target.value })}
              placeholder="우리카드"
              className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} />
            추가
          </button>
        </form>
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-400">불러오는 중...</p>
        ) : (
          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">카드번호</th>
                  <th className="px-2 py-1.5">승인번호 앞자리</th>
                  <th className="px-2 py-1.5">매입사명</th>
                  <th className="px-2 py-1.5">카드종류</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5 text-slate-600">
                      {r.card_prefix_1}-{r.card_prefix_2}-****-****
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">{r.approval_prefix}</td>
                    <td className="px-2 py-1.5">{r.acquirer}</td>
                    <td className="px-2 py-1.5">{r.card_type}</td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => handleDelete(r.id)} className="text-slate-400 hover:text-red-600" title="삭제">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rules.length === 0 && <p className="p-3 text-sm text-slate-400">등록된 카드정보가 없습니다</p>}
          </div>
        )}
      </div>
    </div>
  )
}

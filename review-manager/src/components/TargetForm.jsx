import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { WEEKDAY_LABELS } from '../lib/format.js'
import TargetList from './TargetList.jsx'

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

const EMPTY = {
  platform: 'naver',
  store_id: '',
  required_count: 1,
  unit_price: 0,
  sale_price: '',
  work_days: ALL_DAYS,
}

export default function TargetForm() {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [targets, setTargets] = useState([])
  const [stores, setStores] = useState([])

  async function refreshTargets() {
    setTargets(await api.getTargets())
  }

  async function refreshStores(platform) {
    const list = await api.getStores(platform)
    setStores(list)
    setForm((prev) => ({ ...prev, store_id: list[0]?.id ?? '' }))
  }

  useEffect(() => {
    refreshTargets()
    refreshStores('naver')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePlatformChange(platform) {
    setForm((prev) => ({ ...prev, platform }))
    refreshStores(platform)
  }

  function toggleWorkDay(day) {
    setForm((prev) => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter((d) => d !== day)
        : [...prev.work_days, day],
    }))
  }

  async function handleDelete(id) {
    if (!confirm('이 캠페인을 삭제할까요? (클레임되었거나 완료된 작업이 있으면 삭제할 수 없습니다)')) return
    try {
      await api.deleteTarget(id)
      await refreshTargets()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.store_id) {
      setError('먼저 "매장 관리" 탭에서 매장을 등록해주세요.')
      return
    }
    if (form.work_days.length === 0) {
      setError('작업요일을 최소 하루 이상 선택해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      const target = await api.createTarget({
        store_id: Number(form.store_id),
        required_count: Number(form.required_count),
        unit_price: Number(form.unit_price),
        sale_price: form.sale_price === '' ? null : Number(form.sale_price),
        work_days: form.work_days,
      })
      setMessage(
        `"${target.store_name}" 등록 완료 — ${target.required_count}건이 오픈풀에 등록되었습니다. 리뷰어가 직접 클레임합니다.`,
      )
      setForm((prev) => ({ ...prev, required_count: 1, unit_price: 0, sale_price: '' }))
      await refreshTargets()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-w-md flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="block text-xs text-slate-500">플랫폼</label>
          <select
            value={form.platform}
            onChange={(e) => handlePlatformChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="naver">네이버영수증</option>
            <option value="kakao">카카오맵</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">매장</label>
          <select
            value={form.store_id}
            onChange={(e) => setForm({ ...form, store_id: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {stores.length === 0 && <option value="">등록된 매장 없음</option>}
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500">건수</label>
            <input
              type="number"
              min="1"
              value={form.required_count}
              onChange={(e) => setForm({ ...form, required_count: e.target.value })}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500">건당 단가 (원, 리뷰어 정산)</label>
            <input
              type="number"
              min="0"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500">
            건당 판매금액 (원, 매장 청구 — 선택, 정산요약의 매출 집계에 사용)
          </label>
          <input
            type="number"
            min="0"
            value={form.sale_price}
            onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
            placeholder="비워두면 매출 집계에서 제외됩니다"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">작업요일 (선택한 요일에만 오픈풀에 노출)</label>
          <div className="mt-1 flex gap-1">
            {WEEKDAY_LABELS.map((label, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleWorkDay(day)}
                className={`h-7 w-7 rounded text-xs font-medium ${
                  form.work_days.includes(day)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <button
            type="submit"
            disabled={submitting || !form.store_id}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            등록 (오픈풀에 공개)
          </button>
        </div>
        <p className="text-xs text-slate-400">
          매장 목록에 없다면 먼저 "매장 관리" 탭에서 등록해주세요. 등록된 작업은 자동
          배정되지 않고 오픈풀에 공개되며, 리뷰어가 셀프서비스 포털의 "가능한 작업 (오픈풀)"
          목록에서 직접 "할게요"를 눌러 클레임합니다. 작업 제한시간(리뷰어가 클레임 후 결과
          링크를 제출해야 하는 시간)은 "설정" 탭에서 관리합니다.
        </p>
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      <TargetList targets={targets} onDelete={handleDelete} />
    </div>
  )
}

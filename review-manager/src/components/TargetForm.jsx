import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import TargetList from './TargetList.jsx'

const EMPTY = {
  platform: 'naver',
  store_id: '',
  required_count: 1,
  unit_price: 0,
  claim_time_limit_hours: 24,
}

export default function TargetForm() {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [targets, setTargets] = useState([])
  const [settings, setSettings] = useState(null)
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
    api.getSettings().then(setSettings)
    refreshStores('naver')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePlatformChange(platform) {
    const defaultHours = settings
      ? platform === 'naver'
        ? settings.naver_default_claim_hours
        : settings.kakao_default_claim_hours
      : form.claim_time_limit_hours
    setForm((prev) => ({ ...prev, platform, claim_time_limit_hours: defaultHours }))
    refreshStores(platform)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.store_id) {
      setError('먼저 "매장 관리" 탭에서 매장을 등록해주세요.')
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
        claim_time_limit_hours: Number(form.claim_time_limit_hours),
      })
      setMessage(
        `"${target.store_name}" 등록 완료 — ${target.required_count}건이 오픈풀에 등록되었습니다. 리뷰어가 직접 클레임합니다.`,
      )
      setForm((prev) => ({ ...prev, required_count: 1, unit_price: 0 }))
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
        className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-6"
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
        <div className="sm:col-span-3">
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
        <div>
          <label className="block text-xs text-slate-500">건수</label>
          <input
            type="number"
            min="1"
            value={form.required_count}
            onChange={(e) => setForm({ ...form, required_count: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">건당 단가 (원)</label>
          <input
            type="number"
            min="0"
            value={form.unit_price}
            onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">클레임 제한시간 (시간)</label>
          <input
            type="number"
            min="1"
            value={form.claim_time_limit_hours}
            onChange={(e) => setForm({ ...form, claim_time_limit_hours: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-end sm:col-span-6">
          <button
            type="submit"
            disabled={submitting || !form.store_id}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            등록 (오픈풀에 공개)
          </button>
        </div>
        <p className="text-xs text-slate-400 sm:col-span-6">
          매장 목록에 없다면 먼저 "매장 관리" 탭에서 등록해주세요. 등록된 작업은 자동
          배정되지 않고 오픈풀에 공개되며, 리뷰어가 셀프서비스 포털에서 직접 "할게요"를
          눌러 클레임합니다. 클레임 제한시간 안에 완료하지 못하면 자동으로 다시 오픈풀로
          돌아갑니다.
        </p>
        {message && <p className="text-sm text-green-700 sm:col-span-6">{message}</p>}
        {error && <p className="text-sm text-red-600 sm:col-span-6">{error}</p>}
      </form>

      <TargetList targets={targets} />
    </div>
  )
}

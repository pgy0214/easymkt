import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { formatDateTime, PLATFORM_LABEL } from '../lib/format.js'

const EMPTY = { platform: 'naver', name: '', url: '', address: '', menu: '', cooldown_days: 90 }

export default function StoreManager() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [autoFillNote, setAutoFillNote] = useState(null)

  async function refresh() {
    setLoading(true)
    try {
      setStores(await api.getStores())
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
    if (!form.name.trim() || !form.url.trim()) return
    setSubmitting(true)
    try {
      const store = await api.createStore({
        ...form,
        name: form.name.trim(),
        url: form.url.trim(),
        address: form.address.trim() || null,
        menu: form.menu.trim() || null,
        cooldown_days: Number(form.cooldown_days),
      })
      setStores((prev) => [...prev, store].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(EMPTY)
      setAutoFillNote(null)
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUrlBlur(e) {
    const url = e.target.value.trim()
    if (!url || form.platform !== 'naver') return
    setAutoFilling(true)
    setAutoFillNote(null)
    try {
      const info = await api.fetchStoreInfo(url)
      setForm((prev) => ({
        ...prev,
        url,
        name: prev.name.trim() || info.name || prev.name,
        address: prev.address.trim() || info.address || prev.address,
        menu: prev.menu.trim() || info.menu || prev.menu,
      }))
      const missing = []
      if (!info.name) missing.push('매장명')
      if (!info.address) missing.push('주소')
      if (!info.menu) missing.push('메뉴')
      setAutoFillNote(
        missing.length > 0
          ? `자동으로 못 찾은 정보(직접 입력해주세요): ${missing.join(', ')}`
          : '매장명/주소/메뉴를 자동으로 채웠어요. 확인 후 등록해주세요.',
      )
    } catch (err) {
      setAutoFillNote(`자동 입력 실패: ${err.message} — 직접 입력해주세요.`)
    } finally {
      setAutoFilling(false)
    }
  }

  async function handleFieldChange(store, field, value) {
    if (value === store[field]) return
    try {
      const updated = await api.updateStore(store.id, { [field]: value })
      setStores((prev) => prev.map((s) => (s.id === store.id ? updated : s)))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('이 매장을 삭제할까요?')) return
    try {
      await api.deleteStore(id)
      setStores((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-5"
      >
        <div>
          <label className="block text-xs text-slate-500">플랫폼</label>
          <select
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="naver">네이버영수증</option>
            <option value="kakao">카카오맵</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500">매장 URL</label>
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            onBlur={handleUrlBlur}
            placeholder="네이버 플레이스 URL을 입력하면 자동으로 채워요"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500">매장명 {autoFilling && '(자동 입력 중...)'}</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">재작업 가능 주기 (일)</label>
          <input
            type="number"
            min="1"
            value={form.cooldown_days}
            onChange={(e) => setForm({ ...form, cooldown_days: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-slate-500">매장주소</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500">매장메뉴 (선택)</label>
          <input
            value={form.menu}
            onChange={(e) => setForm({ ...form, menu: e.target.value })}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div className="flex items-end sm:col-span-5">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1 rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} />
            매장 등록
          </button>
        </div>
        {autoFillNote && (
          <p className="text-xs text-amber-600 sm:col-span-5">{autoFillNote}</p>
        )}
        <p className="text-xs text-slate-400 sm:col-span-5">
          같은 매장을 여러 번 캠페인에 쓰려면 여기서 한 번만 등록해두세요. "캠페인 등록"에서는
          이 목록 중에서 골라 캠페인을 만듭니다. 재작업 가능 주기는 같은 계정이 이 매장을 다시
          리뷰할 수 있기까지 걸리는 기간입니다. 네이버 매장은 URL 입력 후 다른 칸을 클릭하면
          매장명/주소/메뉴를 자동으로 긁어옵니다(카카오는 아직 지원하지 않아요).
        </p>
      </form>

      {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">플랫폼</th>
              <th className="px-3 py-2">매장명</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">주소</th>
              <th className="px-3 py-2">메뉴</th>
              <th className="px-3 py-2">재작업 주기(일)</th>
              <th className="px-3 py-2">등록일</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stores.map((store) => (
              <tr key={store.id}>
                <td className="px-3 py-2">{PLATFORM_LABEL[store.platform]}</td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={store.name}
                    onBlur={(e) => handleFieldChange(store, 'name', e.target.value.trim())}
                    className="w-32 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <input
                      defaultValue={store.url}
                      onBlur={(e) => handleFieldChange(store, 'url', e.target.value.trim())}
                      className="w-48 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                    />
                    <a href={store.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-600">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={store.address || ''}
                    onBlur={(e) => handleFieldChange(store, 'address', e.target.value.trim())}
                    className="w-32 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={store.menu || ''}
                    title={store.menu || ''}
                    onBlur={(e) => handleFieldChange(store, 'menu', e.target.value.trim())}
                    className="w-32 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="1"
                    defaultValue={store.cooldown_days}
                    onBlur={(e) => handleFieldChange(store, 'cooldown_days', Number(e.target.value))}
                    className="w-20 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                  />
                </td>
                <td className="px-3 py-2 text-slate-500">{formatDateTime(store.created_at)}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleDelete(store.id)}
                    className="text-slate-400 hover:text-red-600"
                    title="매장 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stores.length === 0 && !loading && (
          <p className="p-3 text-sm text-slate-400">등록된 매장이 없습니다</p>
        )}
      </div>
    </div>
  )
}

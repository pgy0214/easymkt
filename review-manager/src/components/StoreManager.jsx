import { ExternalLink, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { formatDateTime, PLATFORM_LABEL } from '../lib/format.js'

const EMPTY = { platform: 'naver', url: '', cooldown_days: 90 }

export default function StoreManager() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [fetched, setFetched] = useState(null) // { name, address, business_hours, menu }
  const [menuInput, setMenuInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  function resetForm() {
    setForm(EMPTY)
    setFetched(null)
    setFetchError(null)
    setMenuInput('')
  }

  async function handleFetchInfo() {
    const url = form.url.trim()
    if (!url) return
    if (form.platform !== 'naver') {
      setFetchError('카카오맵은 아직 자동입력을 지원하지 않아요.')
      return
    }
    setFetching(true)
    setFetchError(null)
    setFetched(null)
    try {
      const info = await api.fetchStoreInfo(url)
      setFetched(info)
      setMenuInput(info.menu || '')
      if (!info.name) {
        setFetchError('매장명을 찾지 못했어요. URL이 맞는지 확인하고 다시 시도해주세요.')
      }
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setFetching(false)
    }
  }

  async function handleConfirm() {
    if (!fetched || !fetched.name) return
    setSubmitting(true)
    try {
      const store = await api.createStore({
        platform: form.platform,
        name: fetched.name,
        url: form.url.trim(),
        address: fetched.address || null,
        business_hours: fetched.business_hours || null,
        menu: menuInput.trim() || null,
        cooldown_days: Number(form.cooldown_days),
      })
      setStores((prev) => [...prev, store].sort((a, b) => a.name.localeCompare(b.name)))
      resetForm()
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
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
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs text-slate-500">플랫폼</label>
            <select
              value={form.platform}
              onChange={(e) => {
                resetForm()
                setForm((prev) => ({ ...prev, platform: e.target.value }))
              }}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="naver">네이버영수증</option>
              <option value="kakao">카카오맵</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-500">매장 URL</label>
            <div className="flex gap-1">
              <input
                value={form.url}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, url: e.target.value }))
                  setFetched(null)
                  setFetchError(null)
                }}
                placeholder="https://naver.me/..."
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={handleFetchInfo}
                disabled={fetching || !form.url.trim()}
                className="shrink-0 rounded bg-slate-700 px-3 py-1 text-xs text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {fetching ? '가져오는 중...' : '입력완료'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500">재작업 가능 주기 (일)</label>
            <input
              type="number"
              min="1"
              value={form.cooldown_days}
              onChange={(e) => setForm((prev) => ({ ...prev, cooldown_days: e.target.value }))}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        </div>

        {fetchError && <p className="text-xs text-red-600">{fetchError}</p>}

        {fetched && (
          <div className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">
              아래 내용은 네이버에서 가져온 정보라 직접 수정할 수 없어요 (메뉴 제외). URL이
              잘못됐다면 위에서 URL을 고치고 "입력완료"를 다시 눌러주세요.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <span className="block text-xs text-slate-500">매장명</span>
                <p className="text-sm text-slate-800">{fetched.name || '-'}</p>
              </div>
              <div>
                <span className="block text-xs text-slate-500">매장주소</span>
                <p className="text-sm text-slate-800">{fetched.address || '-'}</p>
              </div>
              <div>
                <span className="block text-xs text-slate-500">운영시간</span>
                <p className="text-sm text-slate-800">{fetched.business_hours || '-'}</p>
              </div>
              <div className="sm:col-span-3">
                <span className="block text-xs text-slate-500">
                  매장메뉴 {fetched.menu ? '' : '(못 찾음 — 직접 입력 가능)'}
                </span>
                {fetched.menu ? (
                  <p className="text-sm text-slate-800">{fetched.menu}</p>
                ) : (
                  <input
                    value={menuInput}
                    onChange={(e) => setMenuInput(e.target.value)}
                    placeholder="메뉴가 없으면 비워두세요"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !fetched.name}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '확인, 이 정보로 매장 등록'}
            </button>
          </div>
        )}
      </div>

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
              <th className="px-3 py-2">운영시간</th>
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
                <td className="px-3 py-2 text-slate-700">{store.name}</td>
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
                <td className="px-3 py-2 text-slate-700" title={store.address || ''}>
                  {store.address || '-'}
                </td>
                <td className="px-3 py-2 text-slate-700" title={store.business_hours || ''}>
                  {store.business_hours || '-'}
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

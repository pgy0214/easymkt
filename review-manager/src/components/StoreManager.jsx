import { ExternalLink, Loader2, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { formatBusinessNumber, formatDateTime, PLATFORM_LABEL } from '../lib/format.js'
import ProductRowsEditor from './ProductRowsEditor.jsx'
import StoreEditModal from './StoreEditModal.jsx'

const EMPTY = { platform: 'naver', url: '', cooldown_days: 90 }

export default function StoreManager() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [fetched, setFetched] = useState(null) // { name, address, representative_hours, representative_product }
  const [productInput, setProductInput] = useState('')
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('')
  const [representativeName, setRepresentativeName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingStore, setEditingStore] = useState(null)
  // ProductRowsEditor는 마운트 시점에만 value를 행으로 파싱하므로, 외부에서
  // productInput이 바뀌는 경우(양식 초기화/새 URL 조회)엔 key를 바꿔 강제로
  // 다시 마운트시켜야 그 값이 반영된다.
  const [productEditorKey, setProductEditorKey] = useState(0)

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
    setProductInput('')
    setBusinessRegistrationNumber('')
    setRepresentativeName('')
    setPhone('')
    setProductEditorKey((k) => k + 1)
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
      setProductInput(info.representative_product || '')
      setProductEditorKey((k) => k + 1)
      if (!info.name) {
        setFetchError('매장명을 찾지 못했어요. URL이 맞는지 확인하고 다시 시도해주세요.')
      }
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setFetching(false)
    }
  }

  const businessInfoComplete =
    businessRegistrationNumber.trim() && representativeName.trim() && phone.trim()

  async function handleConfirm() {
    if (!fetched || !fetched.name || !businessInfoComplete) return
    setSubmitting(true)
    try {
      const store = await api.createStore({
        platform: form.platform,
        name: fetched.name,
        url: form.url.trim(),
        address: fetched.address || null,
        representative_hours: fetched.representative_hours || null,
        representative_product: productInput.trim() || null,
        cooldown_days: Number(form.cooldown_days),
        business_registration_number: businessRegistrationNumber.trim() || null,
        representative_name: representativeName.trim() || null,
        phone: phone.trim() || null,
      })
      setStores((prev) => [...prev, store].sort((a, b) => a.name.localeCompare(b.name)))
      resetForm()
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
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

  function handleSaved(updated) {
    setStores((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setEditingStore(null)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex max-w-md flex-col gap-3">
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
          <div>
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
                className="flex shrink-0 items-center gap-1 rounded bg-slate-700 px-3 py-1 text-xs text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {fetching && <Loader2 size={12} className="animate-spin" />}
                {fetching ? '가져오는 중...' : '입력완료'}
              </button>
            </div>
            {fetching && (
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                <Loader2 size={12} className="animate-spin" />
                네이버에서 매장 정보를 가져오고 있어요 (몇 초 걸릴 수 있어요)...
              </p>
            )}
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
              아래 내용은 네이버에서 가져온 정보라 직접 수정할 수 없어요 (대표상품 제외). URL이
              잘못됐다면 위에서 URL을 고치고 "입력완료"를 다시 눌러주세요.
            </p>
            <p className="text-xs text-slate-400">
              아래 정보는 영수증 제작시 사용되는 정보입니다. 시간은 영업시간 내라면 무시하셔도
              됩니다.
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
                <span className="block text-xs text-slate-500">대표시간</span>
                <p className="text-sm text-slate-800">{fetched.representative_hours || '-'}</p>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-500">영수증 생성에 쓰이는 사업자 정보 (필수)</p>
              <input
                value={businessRegistrationNumber}
                onChange={(e) => setBusinessRegistrationNumber(formatBusinessNumber(e.target.value))}
                placeholder="사업자번호 (예: 250-07-00453)"
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                placeholder="대표자명"
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="전화번호 (예: 0507-1412-5171)"
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </div>

            <div>
              <span className="block text-xs text-slate-500">대표상품</span>
              {fetched.representative_product ? (
                <p className="text-sm text-slate-800">{fetched.representative_product}</p>
              ) : (
                <>
                  <p className="text-xs text-amber-600">
                    *플레이스에 등록된 정보를 찾을 수가 없습니다 직접 입력해주세요.
                  </p>
                  <div className="mt-1">
                    <ProductRowsEditor
                      key={productEditorKey}
                      value={productInput}
                      onChange={setProductInput}
                    />
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !fetched.name || !businessInfoComplete}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '확인, 이 정보로 매장 등록'}
            </button>
            {!businessInfoComplete && (
              <p className="text-xs text-slate-400">
                사업자번호/대표자명/전화번호를 모두 입력해야 등록할 수 있어요.
              </p>
            )}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">플랫폼</th>
              <th className="px-3 py-2">매장명</th>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">주소</th>
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
                  <button
                    onClick={() => setEditingStore(store)}
                    className="text-slate-700 hover:text-blue-600 hover:underline"
                    title="클릭해서 대표시간/대표상품 등 매장 정보 확인"
                  >
                    {store.name}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <a
                      href={store.url}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-[10rem] truncate text-xs text-blue-600 hover:underline"
                      title={store.url}
                    >
                      {store.url}
                    </a>
                    <ExternalLink size={12} className="shrink-0 text-slate-400" />
                  </div>
                </td>
                <td className="px-3 py-2 text-slate-700" title={store.address || ''}>
                  {store.address || '-'}
                </td>
                <td className="px-3 py-2">{store.cooldown_days}</td>
                <td className="px-3 py-2 text-slate-500">{formatDateTime(store.created_at)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingStore(store)}
                      className="text-slate-400 hover:text-blue-600"
                      title="매장 수정"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(store.id)}
                      className="text-slate-400 hover:text-red-600"
                      title="매장 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stores.length === 0 && !loading && (
          <p className="p-3 text-sm text-slate-400">등록된 매장이 없습니다</p>
        )}
      </div>

      {editingStore && (
        <StoreEditModal
          store={editingStore}
          onClose={() => setEditingStore(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

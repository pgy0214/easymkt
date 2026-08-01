import { Receipt } from 'lucide-react'
import { useEffect, useState } from 'react'
import { API_ORIGIN, api } from '../lib/api.js'
import { PLATFORM_LABEL } from '../lib/format.js'

const MAX_COUNT = 50

export default function ReceiptGenerator() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState('')
  const [date, setDate] = useState('')
  const [count, setCount] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [receiptUrls, setReceiptUrls] = useState([])

  useEffect(() => {
    api
      .getStores()
      .then(setStores)
      .finally(() => setLoading(false))
  }, [])

  const store = stores.find((s) => s.id === Number(storeId)) ?? null

  async function handleGenerate() {
    if (!store) return
    setGenerating(true)
    setError(null)
    setReceiptUrls([])
    try {
      const results = await api.generateStoreReceipt(store.id, { date, count })
      setReceiptUrls(results.map((r) => r.url))
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        매장 관리에 등록된 사업자 정보와 대표상품을 기준으로 영수증 이미지를 즉석에서
        만들어볼 수 있어요. 대표상품이 등록되지 않은 매장은 만들 수 없습니다.
      </p>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs text-slate-500">매장</label>
          <select
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value)
              setReceiptUrls([])
              setError(null)
            }}
            className="w-64 rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">매장 선택</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                [{PLATFORM_LABEL[s.platform]}] {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">생성할 날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">개수 (최대 {MAX_COUNT})</label>
          <input
            type="number"
            min="1"
            max={MAX_COUNT}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(MAX_COUNT, Number(e.target.value) || 1)))}
            className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={!store || generating}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Receipt size={14} />
          {generating ? '생성 중...' : '영수증 생성'}
        </button>
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}

      {store && !store.representative_product && (
        <p className="text-sm text-amber-600">
          이 매장은 대표상품(메뉴/금액)이 등록되어 있지 않아요. 매장 관리에서 먼저 등록해주세요.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {receiptUrls.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {receiptUrls.map((url) => (
            <div key={url} className="rounded-lg border border-slate-200 bg-white p-3">
              <img
                src={`${API_ORIGIN}${url}`}
                alt="생성된 영수증"
                className="w-full rounded border border-slate-200"
              />
              <a
                href={`${API_ORIGIN}${url}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-blue-600 hover:underline"
              >
                새 탭에서 원본 보기
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import JSZip from 'jszip'
import { Download, Receipt } from 'lucide-react'
import { useEffect, useState } from 'react'
import { API_ORIGIN, api } from '../lib/api.js'
import { PLATFORM_LABEL } from '../lib/format.js'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'
import Input from './ui/Input.jsx'

const MAX_COUNT = 50

function todayForFilename() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

export default function ReceiptGenerator() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [storeId, setStoreId] = useState('')
  const [date, setDate] = useState('')
  const [count, setCount] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [receiptUrls, setReceiptUrls] = useState([])
  const [downloadPrefix, setDownloadPrefix] = useState('')
  const [downloadingAll, setDownloadingAll] = useState(false)

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
      setDownloadPrefix(`${store.name}_${date ? date.replaceAll('-', '') : todayForFilename()}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload(url, index) {
    const suffix = receiptUrls.length > 1 ? `_${index + 1}` : ''
    const res = await fetch(`${API_ORIGIN}${url}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `${downloadPrefix}${suffix}.jpg`
    a.click()
    URL.revokeObjectURL(objectUrl)
  }

  async function handleDownloadAll() {
    if (receiptUrls.length === 0) return
    setDownloadingAll(true)
    try {
      const zip = new JSZip()
      const blobs = await Promise.all(
        receiptUrls.map((url) => fetch(`${API_ORIGIN}${url}`).then((res) => res.blob())),
      )
      blobs.forEach((blob, i) => {
        const suffix = receiptUrls.length > 1 ? `_${i + 1}` : ''
        zip.file(`${downloadPrefix}${suffix}.jpg`, blob)
      })
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const objectUrl = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `${downloadPrefix}_전체${receiptUrls.length}건.zip`
      a.click()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      alert(err.message)
    } finally {
      setDownloadingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        매장 관리에 등록된 사업자 정보와 대표상품을 기준으로 영수증 이미지를 즉석에서
        만들어볼 수 있어요. 대표상품이 등록되지 않은 매장은 만들 수 없습니다.
      </p>

      <div className="flex flex-wrap items-end gap-2 rounded-card border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-xs text-gray-500">매장</label>
          <select
            value={storeId}
            onChange={(e) => {
              setStoreId(e.target.value)
              setReceiptUrls([])
              setError(null)
            }}
            className="w-64 rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
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
          <label className="block text-xs text-gray-500">생성할 날짜</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500">개수 (최대 {MAX_COUNT})</label>
          <Input
            type="number"
            min="1"
            max={MAX_COUNT}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(MAX_COUNT, Number(e.target.value) || 1)))}
            className="w-20"
          />
        </div>
        <Button onClick={handleGenerate} disabled={!store || generating}>
          <Receipt size={14} />
          {generating ? '생성 중...' : '영수증 생성'}
        </Button>
      </div>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}

      {store && !store.representative_product && (
        <p className="text-sm text-amber-600">
          이 매장은 대표상품(메뉴/금액)이 등록되어 있지 않아요. 매장 관리에서 먼저 등록해주세요.
        </p>
      )}

      {error && <p className="text-sm text-danger-text">{error}</p>}

      {receiptUrls.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">생성된 영수증 {receiptUrls.length}건</p>
          <Button onClick={handleDownloadAll} disabled={downloadingAll} variant="secondary" size="sm">
            <Download size={14} />
            {downloadingAll ? '압축 중...' : '전체 일괄 다운로드 (ZIP)'}
          </Button>
        </div>
      )}

      {receiptUrls.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {receiptUrls.map((url, i) => (
            <Card key={url} padding="sm">
              <img
                src={`${API_ORIGIN}${url}`}
                alt="생성된 영수증"
                className="w-full rounded border border-gray-200"
              />
              <div className="mt-2 flex items-center gap-3 text-xs">
                <button
                  onClick={() => handleDownload(url, i)}
                  className="flex items-center gap-1 text-brand-600 hover:underline"
                >
                  <Download size={12} />
                  JPG 다운로드
                </button>
                <a
                  href={`${API_ORIGIN}${url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  새 탭에서 원본 보기
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

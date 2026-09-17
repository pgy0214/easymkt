import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { formatKRW } from '../lib/format.js'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'

export default function OrderConvertModal({ order, onClose, onConverted }) {
  const item = order.items[0]

  const [checkingExisting, setCheckingExisting] = useState(true)
  const [storeId, setStoreId] = useState(null)

  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [fetched, setFetched] = useState(null) // { name, address, representative_hours, representative_product }
  const [productInput, setProductInput] = useState('')
  const [cooldownDays, setCooldownDays] = useState(90)
  const [creatingStore, setCreatingStore] = useState(false)

  const [requiredCount, setRequiredCount] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [salePrice, setSalePrice] = useState(String(order.total_price))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    // 이미 같은 URL로 등록된 매장이 있으면 새로 크롤링하지 않고 바로 재사용 —
    // 중복 매장 방지(문자열 완전일치만 확인, 알려진 한계는 계획 문서 참고)
    api
      .getStores('naver')
      .then((stores) => {
        const existing = stores.find((s) => s.url === order.store_url)
        if (existing) setStoreId(existing.id)
      })
      .finally(() => setCheckingExisting(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFetchInfo() {
    setFetching(true)
    setFetchError(null)
    setFetched(null)
    try {
      const info = await api.fetchStoreInfo(order.store_url)
      setFetched(info)
      setProductInput(info.representative_product || '')
      if (!info.name) {
        setFetchError('매장명을 찾지 못했어요. URL이 맞는지 확인하고 다시 시도해주세요.')
      }
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setFetching(false)
    }
  }

  async function handleCreateStore() {
    if (!fetched || !fetched.name) return
    setCreatingStore(true)
    try {
      const store = await api.createStore({
        platform: 'naver',
        name: fetched.name,
        url: order.store_url,
        address: fetched.address || null,
        representative_hours: fetched.representative_hours || null,
        representative_product: productInput.trim() || null,
        cooldown_days: Number(cooldownDays),
      })
      setStoreId(store.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setCreatingStore(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const updated = await api.convertOrder(order.id, {
        store_id: storeId,
        required_count: Number(requiredCount),
        unit_price: Number(unitPrice),
        sale_price: salePrice.trim() ? Number(salePrice) : null,
      })
      onConverted(updated)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open onClose={onClose} size="md">
      <h3 className="font-medium text-gray-800">주문 #{order.id} → 캠페인 만들기</h3>
      <p className="text-xs text-gray-500">
        {item.product_name} — {item.option_label} · 결제금액 {formatKRW(order.total_price)}
      </p>

      {checkingExisting ? (
        <p className="text-sm text-gray-400">매장 확인 중...</p>
      ) : !storeId ? (
        <div className="space-y-2 rounded-btn border border-gray-100 bg-gray-50 p-3">
          <p className="text-sm text-gray-700">매장 URL: {order.store_url}</p>
          <Button type="button" size="sm" onClick={handleFetchInfo} disabled={fetching}>
            {fetching ? '가져오는 중...' : '매장 정보 가져오기'}
          </Button>
          {fetchError && <p className="text-sm text-danger-text">{fetchError}</p>}
          {fetched && fetched.name && (
            <div className="space-y-2">
              <p className="text-sm text-gray-800">{fetched.name}</p>
              <p className="text-xs text-gray-500">{fetched.address || '-'}</p>
              <p className="text-xs text-gray-500">대표시간: {fetched.representative_hours || '-'}</p>
              <Input
                label="대표상품"
                value={productInput}
                onChange={(e) => setProductInput(e.target.value)}
                placeholder="예: 아메리카노 4500원, 카페라떼 5000원"
              />
              <Input
                label="재작업가능주기(일)"
                type="number"
                value={cooldownDays}
                onChange={(e) => setCooldownDays(e.target.value)}
              />
              <Button type="button" size="sm" onClick={handleCreateStore} disabled={creatingStore}>
                {creatingStore ? '등록 중...' : '확인, 이 매장으로 등록'}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2">
          <Input
            label="필요 건수"
            type="number"
            required
            value={requiredCount}
            onChange={(e) => setRequiredCount(e.target.value)}
            placeholder={item.option_label}
          />
          <Input
            label="리뷰어 정산단가(건당, 원)"
            type="number"
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
          <Input
            label="매출(선택, 원)"
            type="number"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
          />
          <p className="text-xs text-gray-400">
            가이드라인·메뉴 등 원고 자료는 생성 후 "캠페인 등록/목록"의 수정에서 추가할 수 있어요.
          </p>
          {error && <p className="text-sm text-danger-text">{error}</p>}
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            캠페인 만들기
          </Button>
        </form>
      )}
    </Modal>
  )
}

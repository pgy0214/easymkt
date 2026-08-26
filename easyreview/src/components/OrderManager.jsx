import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import Badge from './ui/Badge.jsx'
import Button from './ui/Button.jsx'

const STATUS_LABEL = {
  pending_payment: '입금대기',
  paid: '입금확인',
  cancelled: '취소',
}

const STATUS_VARIANT = {
  pending_payment: 'warning',
  paid: 'success',
  cancelled: 'neutral',
}

export default function OrderManager() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  function refresh() {
    setLoading(true)
    api
      .getOrders()
      .then(setOrders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  async function handleStatusChange(order, status) {
    setUpdatingId(order.id)
    try {
      const updated = await api.updateOrderStatus(order.id, status)
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
    } catch (err) {
      alert(err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">불러오는 중...</p>
  if (error) return <p className="text-sm text-danger-text">{error}</p>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">주문 관리 (easystore)</h2>
        <p className="text-xs text-gray-400">
          PG 없이 계좌이체만 지원 — 입금 확인되면 "입금확인" 처리 후, 실행 사이트(캠페인
          등록/목록)에서 이 주문 정보로 캠페인을 직접 개설해주세요.
        </p>
      </div>

      {orders.length === 0 && <p className="text-sm text-gray-400">주문이 없습니다.</p>}

      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="rounded-card border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-800">
                    #{order.id} {order.buyer_name}
                  </span>
                  <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
                </div>
                <p className="text-xs text-gray-400">
                  {order.buyer_phone} · 입금자명 "{order.depositor_name}" · {formatDateTime(order.created_at)}
                </p>
              </div>
              <span className="font-semibold text-gray-900">{order.total_price.toLocaleString()}원</span>
            </div>

            <div className="mb-2 space-y-1">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm text-gray-600">
                  <span>
                    {item.product_name} — {item.option_label} × {item.quantity}
                  </span>
                  <span>{(item.unit_price * item.quantity).toLocaleString()}원</span>
                </div>
              ))}
            </div>

            {order.memo && <p className="mb-2 text-xs text-gray-500">메모: {order.memo}</p>}

            {order.status === 'pending_payment' && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={updatingId === order.id}
                  onClick={() => handleStatusChange(order, 'paid')}
                >
                  입금확인 처리
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={updatingId === order.id}
                  onClick={() => handleStatusChange(order, 'cancelled')}
                >
                  취소
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

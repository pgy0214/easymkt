import { useEffect, useState } from 'react'
import { settingsApi } from '../lib/api.js'
import { navigate } from '../App.jsx'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

export default function OrderCompletePage() {
  const [order] = useState(() => {
    const raw = sessionStorage.getItem('last_order')
    return raw ? JSON.parse(raw) : null
  })
  const [bankInfo, setBankInfo] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    settingsApi.getBankInfo().then(setBankInfo).catch((err) => setError(err.message))
  }, [])

  if (!order) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <div className="mx-auto max-w-md px-4 py-8 text-center">
          <p className="mb-4 text-sm text-gray-400">주문 정보를 찾을 수 없습니다.</p>
          <button onClick={() => navigate('/')} className="text-sm text-brand-600 hover:underline">
            목록으로
          </button>
        </div>
      </div>
    )
  }

  const bankReady = bankInfo?.bank_name && bankInfo?.bank_account_number

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="mb-1 text-lg font-bold text-gray-900">주문이 접수되었습니다</h1>
        <p className="mb-6 text-sm text-gray-500">주문번호 #{order.id}</p>

        <div className="mb-4 rounded-card border border-gray-200 p-4">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-gray-700">
              <span>
                {item.product_name} - {item.option_label}
              </span>
              <span>{(item.unit_price * item.quantity).toLocaleString()}원</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-sm font-bold">
            <span>총 결제 금액</span>
            <span>{order.total_price.toLocaleString()}원</span>
          </div>
        </div>

        <div className="mb-4 rounded-card border border-brand-200 bg-brand-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">입금 계좌 안내</h2>
          {error && <p className="text-sm text-danger-text">{error}</p>}
          {!error && !bankInfo && <p className="text-sm text-gray-400">불러오는 중...</p>}
          {!error && bankInfo && !bankReady && (
            <p className="text-sm text-gray-500">
              입금계좌가 아직 등록되지 않았습니다. 관리자에게 문의해주세요.
            </p>
          )}
          {bankReady && (
            <div className="space-y-1 text-sm text-gray-800">
              <p>
                {bankInfo.bank_name} {bankInfo.bank_account_number}
              </p>
              <p>예금주: {bankInfo.bank_account_holder}</p>
              <p className="mt-2 text-xs text-gray-500">
                입금자명 "{order.depositor_name}"(으)로 위 금액을 입금해주세요. 입금 확인 후
                순차적으로 처리됩니다.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full rounded-btn border border-gray-300 py-3 text-sm text-gray-600 hover:bg-gray-50"
        >
          목록으로
        </button>
      </div>

      <Footer />
    </div>
  )
}

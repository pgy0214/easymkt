import { useEffect, useState } from 'react'
import { productApi, orderApi } from '../lib/api.js'
import { navigate } from '../App.jsx'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

const EMPTY_FORM = { buyer_name: '', buyer_phone: '', buyer_email: '', depositor_name: '', memo: '' }

export default function CheckoutPage({ productId, optionId }) {
  const [product, setProduct] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    productApi.get(productId).then(setProduct).catch((err) => setError(err.message))
  }, [productId])

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <p className="p-6 text-center text-sm text-danger-text">{error}</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <p className="p-6 text-center text-sm text-gray-400">불러오는 중...</p>
      </div>
    )
  }

  const option = product.options.find((o) => o.id === optionId)

  if (!option) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <p className="p-6 text-center text-sm text-danger-text">선택한 옵션을 찾을 수 없습니다.</p>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const order = await orderApi.create({
        ...form,
        buyer_email: form.buyer_email || null,
        memo: form.memo || null,
        items: [{ product_id: product.id, option_id: option.id, quantity: 1 }],
      })
      sessionStorage.setItem('last_order', JSON.stringify(order))
      navigate('/order-complete')
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-md px-4 py-8">
        <button
          onClick={() => navigate(`/product/${product.id}`)}
          className="mb-4 text-sm text-gray-500 hover:underline"
        >
          뒤로
        </button>

        <h1 className="mb-4 text-lg font-bold text-gray-900">주문/결제</h1>

        <div className="mb-6 rounded-card border border-gray-200 p-4">
          <div className="flex justify-between text-sm">
            <span>
              {product.name} - {option.label}
            </span>
            <span className="font-semibold">{option.price.toLocaleString()}원</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-sm font-bold">
            <span>결제 금액</span>
            <span>{option.price.toLocaleString()}원</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-gray-400">
            결제는 계좌이체로만 진행됩니다. 아래 정보 입력 후 주문하시면, 다음 화면에서
            입금계좌를 안내해드립니다. 입금 확인 후 순차적으로 처리됩니다.
          </p>
          <div>
            <label className="mb-1 block text-xs text-gray-500">이름</label>
            <input
              required
              value={form.buyer_name}
              onChange={(e) => setForm((prev) => ({ ...prev, buyer_name: e.target.value }))}
              className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">연락처</label>
            <input
              required
              placeholder="010-0000-0000"
              value={form.buyer_phone}
              onChange={(e) => setForm((prev) => ({ ...prev, buyer_phone: e.target.value }))}
              className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">이메일 (선택)</label>
            <input
              type="email"
              value={form.buyer_email}
              onChange={(e) => setForm((prev) => ({ ...prev, buyer_email: e.target.value }))}
              className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">입금자명</label>
            <input
              required
              placeholder="입금하실 분의 실명"
              value={form.depositor_name}
              onChange={(e) => setForm((prev) => ({ ...prev, depositor_name: e.target.value }))}
              className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">요청사항 (선택)</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
              className="w-full rounded-btn border border-gray-300 px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          {submitError && <p className="text-sm text-danger-text">{submitError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-btn bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? '주문 처리 중...' : '주문하기'}
          </button>
        </form>
      </div>

      <Footer />
    </div>
  )
}

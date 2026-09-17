import { useEffect, useState } from 'react'
import { API_ORIGIN, productApi } from '../lib/api.js'
import { navigate } from '../App.jsx'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

const TABS = [
  { key: 'desc', label: '상품설명' },
  { key: 'price', label: '가격' },
  { key: 'review', label: '리뷰' },
  { key: 'qna', label: '문의' },
]

export default function ProductDetailPage({ productId }) {
  const [product, setProduct] = useState(null)
  const [error, setError] = useState(null)
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [tab, setTab] = useState('desc')

  useEffect(() => {
    productApi
      .get(productId)
      .then((p) => {
        setProduct(p)
        const firstActive = p.options.find((o) => o.is_active)
        if (firstActive) setSelectedOptionId(String(firstActive.id))
      })
      .catch((err) => setError(err.message))
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

  const activeOptions = product.options.filter((o) => o.is_active)
  const selectedOption = activeOptions.find((o) => String(o.id) === selectedOptionId)

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-3xl px-4 py-8">
        <button onClick={() => navigate('/')} className="mb-4 text-sm text-gray-500 hover:text-gray-800">
          ← 목록으로
        </button>

        <div className="mb-6 overflow-hidden rounded-card border border-gray-200">
          {product.thumbnail_path ? (
            <img
              src={`${API_ORIGIN}${product.thumbnail_path}`}
              alt={product.name}
              className="aspect-video w-full object-cover"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center bg-gray-50 text-sm text-gray-400">
              이미지 없음
            </div>
          )}
        </div>

        <h1 className="mb-6 text-xl font-bold text-gray-900">{product.name}</h1>

        <div className="mb-8 rounded-card border border-gray-200 bg-gray-50 p-5 shadow-sm">
          {activeOptions.length === 0 ? (
            <p className="text-sm text-gray-400">아직 구매 가능한 옵션이 없습니다.</p>
          ) : (
            <>
              <label className="mb-1 block text-xs font-medium text-gray-500">옵션선택</label>
              <select
                value={selectedOptionId}
                onChange={(e) => setSelectedOptionId(e.target.value)}
                className="mb-4 w-full rounded-btn border border-gray-300 bg-white px-3 py-2.5 text-sm"
              >
                {activeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label} — {o.price.toLocaleString()}원
                  </option>
                ))}
              </select>
              <div className="mb-4 flex items-center justify-between border-t border-gray-200 pt-4">
                <span className="text-sm text-gray-500">결제 금액</span>
                <span className="text-xl font-bold text-gray-900">
                  {selectedOption ? `${selectedOption.price.toLocaleString()}원` : '-'}
                </span>
              </div>
              <button
                onClick={() => navigate(`/checkout/${product.id}?option=${selectedOptionId}`)}
                className="w-full rounded-pill bg-brand-500 py-3.5 text-sm font-semibold text-white hover:bg-brand-600"
              >
                구매하기
              </button>
            </>
          )}
        </div>

        <div className="mb-4 flex border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm ${
                tab === t.key
                  ? 'border-b-2 border-brand-500 font-semibold text-brand-600'
                  : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'desc' && (
          <div className="space-y-2">
            {product.detail_image_paths.length === 0 && (
              <p className="text-sm text-gray-400">등록된 상세 설명이 없습니다.</p>
            )}
            {product.detail_image_paths.map((path) => (
              <img key={path} src={`${API_ORIGIN}${path}`} alt="" className="w-full" />
            ))}
          </div>
        )}

        {tab === 'price' && (
          <div className="space-y-2">
            {activeOptions.length === 0 && <p className="text-sm text-gray-400">등록된 옵션이 없습니다.</p>}
            {activeOptions.map((o) => (
              <div
                key={o.id}
                className="flex justify-between rounded-btn border border-gray-200 px-3 py-2.5 text-sm"
              >
                <span>{o.label}</span>
                <span className="font-semibold">{o.price.toLocaleString()}원</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'review' && <p className="text-sm text-gray-400">아직 등록된 리뷰가 없습니다.</p>}
        {tab === 'qna' && <p className="text-sm text-gray-400">아직 등록된 문의가 없습니다.</p>}
      </div>

      <Footer />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { API_ORIGIN, productApi } from '../lib/api.js'
import { navigate } from '../App.jsx'

function lowestPrice(product) {
  const active = product.options.filter((o) => o.is_active)
  if (active.length === 0) return null
  return Math.min(...active.map((o) => o.price))
}

export default function CategoryPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    productApi
      .list()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">이지스토어</h1>
      </header>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {error && <p className="text-sm text-danger-text">{error}</p>}
      {!loading && !error && products.length === 0 && (
        <p className="text-sm text-gray-400">등록된 상품이 없습니다.</p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => {
          const price = lowestPrice(p)
          return (
            <button
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              className="rounded-card border border-gray-200 bg-white p-3 text-left transition hover:border-brand-300"
            >
              {p.thumbnail_path ? (
                <img
                  src={`${API_ORIGIN}${p.thumbnail_path}`}
                  alt={p.name}
                  className="mb-2 aspect-square w-full rounded-btn object-cover"
                />
              ) : (
                <div className="mb-2 flex aspect-square w-full items-center justify-center rounded-btn bg-gray-50 text-xs text-gray-400">
                  이미지 없음
                </div>
              )}
              <p className="mb-1 line-clamp-2 text-sm text-gray-800">{p.name}</p>
              <p className="text-sm font-semibold text-gray-900">
                {price !== null ? `${price.toLocaleString()}원~` : '가격 문의'}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

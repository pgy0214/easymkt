import { useEffect, useState } from 'react'
import { ShieldCheck, TrendingUp, Users, Zap } from 'lucide-react'
import { API_ORIGIN, productApi } from '../lib/api.js'
import { navigate } from '../App.jsx'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

function lowestPrice(product) {
  const active = product.options.filter((o) => o.is_active)
  if (active.length === 0) return null
  return Math.min(...active.map((o) => o.price))
}

const VALUE_PROPS = [
  { icon: ShieldCheck, title: '검증된 리뷰어 네트워크', desc: '실제 활동 중인 리뷰어가 직접 진행합니다' },
  { icon: Zap, title: '빠른 진행', desc: '신청 후 빠르게 시작할 수 있습니다' },
  { icon: TrendingUp, title: '합리적인 가격', desc: '소상공인도 부담 없는 가격입니다' },
  { icon: Users, title: '편한 상담', desc: '궁금한 점은 언제든 문의해주세요' },
]

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
    <div className="min-h-screen bg-white">
      <Header />

      <section className="bg-gray-900 px-4 py-16 text-center text-white sm:py-24">
        <p className="mb-2 text-sm font-semibold tracking-wide text-brand-300">EASY STORE</p>
        <h1 className="mb-4 text-2xl font-bold leading-snug sm:text-4xl">
          믿을 수 있는 리뷰 마케팅,
          <br />
          이지스토어에서 시작하세요
        </h1>
        <p className="mb-8 text-sm text-gray-300 sm:text-base">
          영수증 리뷰부터 체험단까지, 필요한 상품을 골라 바로 신청하세요
        </p>
        <button
          onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
          className="rounded-pill bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
        >
          상품 보러가기
        </button>
      </section>

      <section id="products" className="mx-auto max-w-5xl px-4 py-16">
        <div className="mb-8 text-center">
          <p className="mb-1 text-sm font-semibold text-brand-600">SERVICE</p>
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">이런 상품을 제공합니다</h2>
        </div>

        {loading && <p className="text-center text-sm text-gray-400">불러오는 중...</p>}
        {error && <p className="text-center text-sm text-danger-text">{error}</p>}
        {!loading && !error && products.length === 0 && (
          <p className="text-center text-sm text-gray-400">등록된 상품이 없습니다.</p>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => {
            const price = lowestPrice(p)
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                className="group overflow-hidden rounded-card border border-gray-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                {p.thumbnail_path ? (
                  <img src={`${API_ORIGIN}${p.thumbnail_path}`} alt={p.name} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center bg-gray-50 text-xs text-gray-400">
                    이미지 없음
                  </div>
                )}
                <div className="p-4">
                  <p className="mb-1 text-xs font-bold text-brand-500">{String(i + 1).padStart(2, '0')}</p>
                  <p className="mb-3 text-base font-semibold text-gray-900">{p.name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-900">
                      {price !== null ? `${price.toLocaleString()}원~` : '가격 문의'}
                    </span>
                    <span className="text-xs font-medium text-brand-600 group-hover:underline">
                      자세히 보기 →
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 text-center">
            <p className="mb-1 text-sm font-semibold text-brand-600">WHY EASYSTORE</p>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">왜 이지스토어인가요?</h2>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {VALUE_PROPS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill bg-brand-50 text-brand-600">
                  <Icon size={22} />
                </div>
                <p className="mb-1 text-sm font-semibold text-gray-900">{title}</p>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

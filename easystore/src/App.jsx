import { useEffect, useState } from 'react'
import CategoryPage from './pages/CategoryPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import OrderCompletePage from './pages/OrderCompletePage.jsx'
import ProductDetailPage from './pages/ProductDetailPage.jsx'

export function navigate(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const productMatch = path.match(/^\/product\/(\d+)$/)
  if (productMatch) return <ProductDetailPage productId={Number(productMatch[1])} />

  const checkoutMatch = path.match(/^\/checkout\/(\d+)$/)
  if (checkoutMatch) {
    const optionId = Number(new URLSearchParams(window.location.search).get('option'))
    return <CheckoutPage productId={Number(checkoutMatch[1])} optionId={optionId} />
  }

  if (path === '/order-complete') return <OrderCompletePage />

  return <CategoryPage />
}

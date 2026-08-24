import { useEffect, useState } from 'react'
import CategoryPage from './pages/CategoryPage.jsx'
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

  const match = path.match(/^\/product\/(\d+)$/)
  if (match) return <ProductDetailPage productId={Number(match[1])} />
  return <CategoryPage />
}

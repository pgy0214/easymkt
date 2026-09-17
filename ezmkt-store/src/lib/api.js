export const API_ORIGIN = import.meta.env.DEV
  ? 'http://localhost:8000'
  : 'https://review-managing-production.up.railway.app'
const BASE_URL = `${API_ORIGIN}/api`

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `요청 실패 (${res.status})`)
  }
  return res.json()
}

export const productApi = {
  list: () => request('/products?active_only=true'),
  get: (id) => request(`/products/${id}`),
}

export const orderApi = {
  create: (data) => request('/orders', { method: 'POST', body: JSON.stringify(data) }),
}

export const settingsApi = {
  getBankInfo: () => request('/settings/bank-info'),
}

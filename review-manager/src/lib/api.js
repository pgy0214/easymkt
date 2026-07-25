const BASE_URL = 'http://localhost:8000/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `요청 실패 (${res.status})`)
  }
  if (res.status === 204) return null
  return res.json()
}

function toQueryString(params) {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  )
  const query = new URLSearchParams(entries).toString()
  return query ? `?${query}` : ''
}

function authedRequest(path, token, options = {}) {
  return request(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}` },
  })
}

export const api = {
  getReviewers: () => request('/reviewers'),
  createReviewer: (data) =>
    request('/reviewers', { method: 'POST', body: JSON.stringify(data) }),
  updateReviewer: (id, data) =>
    request(`/reviewers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteReviewer: (id) => request(`/reviewers/${id}`, { method: 'DELETE' }),

  importReviewers: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/reviewers/import`, { method: 'POST', body: form })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `요청 실패 (${res.status})`)
    }
    return res.json()
  },

  createAccount: (reviewerId, data) =>
    request(`/reviewers/${reviewerId}/accounts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateAccount: (id, data) =>
    request(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
  getAccountStoreHistory: (id) => request(`/accounts/${id}/store-history`),

  getStores: (platform) => request(`/stores${toQueryString({ platform })}`),
  createStore: (data) => request('/stores', { method: 'POST', body: JSON.stringify(data) }),
  updateStore: (id, data) =>
    request(`/stores/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStore: (id) => request(`/stores/${id}`, { method: 'DELETE' }),

  getTargets: () => request('/targets'),
  createTarget: (data) => request('/targets', { method: 'POST', body: JSON.stringify(data) }),
  getTarget: (id) => request(`/targets/${id}`),

  getTasks: (params = {}) => request(`/tasks${toQueryString(params)}`),
  updateTaskResult: (id, resultLink) =>
    request(`/tasks/${id}/result`, {
      method: 'PATCH',
      body: JSON.stringify({ result_link: resultLink }),
    }),
  updateTaskSettlement: (id, data) =>
    request(`/tasks/${id}/settlement`, { method: 'PATCH', body: JSON.stringify(data) }),
  recheckBlind: (id) => request(`/tasks/${id}/recheck-blind`, { method: 'POST' }),

  getSettlementSummary: () => request('/settlement/summary'),

  getSettings: () => request('/settings'),
  updateSettings: (data) =>
    request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
}

export const portalApi = {
  requestOtp: (phone, name) =>
    request('/portal/otp/request', { method: 'POST', body: JSON.stringify({ phone, name }) }),
  verifyOtp: (phone, code) =>
    request('/portal/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code }) }),

  me: (token) => authedRequest('/portal/me', token),
  addAccount: (token, data) =>
    authedRequest('/portal/accounts', token, { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: (token, id) => authedRequest(`/portal/accounts/${id}`, token, { method: 'DELETE' }),

  getPool: (token) => authedRequest('/portal/pool', token),
  getMyTasks: (token) => authedRequest('/portal/tasks/mine', token),
  claimTask: (token, taskId, accountId) =>
    authedRequest(`/portal/tasks/${taskId}/claim`, token, {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId }),
    }),
  submitResult: (token, taskId, link) =>
    authedRequest(`/portal/tasks/${taskId}/result`, token, {
      method: 'PATCH',
      body: JSON.stringify({ result_link: link }),
    }),
}

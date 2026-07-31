const BASE_URL = 'http://localhost:8000/api'
export const API_ORIGIN = 'http://localhost:8000'

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

  importReviewers: async (file, category = 'reviewer') => {
    const form = new FormData()
    form.append('file', file)
    form.append('category', category)
    const res = await fetch(`${BASE_URL}/reviewers/import`, { method: 'POST', body: form })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `요청 실패 (${res.status})`)
    }
    return res.json()
  },
  importAdminAccounts: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/reviewers/import-admin`, { method: 'POST', body: form })
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
  fetchStoreInfo: (url) =>
    request('/stores/fetch-info', { method: 'POST', body: JSON.stringify({ url }) }),

  getTargets: () => request('/targets'),
  createTarget: (data) => request('/targets', { method: 'POST', body: JSON.stringify(data) }),
  updateTarget: (id, data) =>
    request(`/targets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getTarget: (id) => request(`/targets/${id}`),
  deleteTarget: (id) => request(`/targets/${id}`, { method: 'DELETE' }),
  uploadTargetPhoto: async (id, file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/targets/${id}/photo`, { method: 'POST', body: form })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `요청 실패 (${res.status})`)
    }
    return res.json()
  },
  parseTargetGuideline: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE_URL}/targets/parse-guideline`, { method: 'POST', body: form })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `요청 실패 (${res.status})`)
    }
    return res.json()
  },

  getTasks: (params = {}) => request(`/tasks${toQueryString(params)}`),
  updateTaskResult: (id, resultLink) =>
    request(`/tasks/${id}/result`, {
      method: 'PATCH',
      body: JSON.stringify({ result_link: resultLink }),
    }),
  updateTaskSettlement: (id, data) =>
    request(`/tasks/${id}/settlement`, { method: 'PATCH', body: JSON.stringify(data) }),
  recheckBlind: (id) => request(`/tasks/${id}/recheck-blind`, { method: 'POST' }),
  assignTask: (id, accountId) =>
    request(`/tasks/${id}/assign`, { method: 'POST', body: JSON.stringify({ account_id: accountId }) }),

  getSettlementSummary: () => request('/settlement/summary'),
  getRevenue: (dateFrom, dateTo) =>
    request(`/settlement/revenue${toQueryString({ date_from: dateFrom, date_to: dateTo })}`),

  getSettings: () => request('/settings'),
  updateSettings: (data) =>
    request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  getNotifyStatus: () => request('/notify/status'),
  sendBulkMessage: (data) => request('/notify/bulk', { method: 'POST', body: JSON.stringify(data) }),
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
  getTaskBrief: (token, taskId) => authedRequest(`/portal/tasks/${taskId}/brief`, token),
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

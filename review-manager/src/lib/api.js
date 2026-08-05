const BASE_URL = 'http://localhost:8000/api'
export const API_ORIGIN = 'http://localhost:8000'
const ADMIN_TOKEN_KEY = 'admin_token'

function adminAuthHeader() {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...adminAuthHeader(), ...options.headers },
  })
  if (res.status === 401 && !path.startsWith('/portal')) {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `요청 실패 (${res.status})`)
  }
  if (res.status === 204) return null
  return res.json()
}

async function uploadRequest(path, form) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: form,
    headers: adminAuthHeader(),
  })
  if (res.status === 401) {
    localStorage.removeItem(ADMIN_TOKEN_KEY)
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `요청 실패 (${res.status})`)
  }
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
  login: (username, password) =>
    request('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getReviewers: () => request('/reviewers'),
  createReviewer: (data) =>
    request('/reviewers', { method: 'POST', body: JSON.stringify(data) }),
  updateReviewer: (id, data) =>
    request(`/reviewers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteReviewer: (id) => request(`/reviewers/${id}`, { method: 'DELETE' }),

  importReviewers: (file, category = 'reviewer') => {
    const form = new FormData()
    form.append('file', file)
    form.append('category', category)
    return uploadRequest('/reviewers/import', form)
  },
  importAdminAccounts: (file) => {
    const form = new FormData()
    form.append('file', file)
    return uploadRequest('/reviewers/import-admin', form)
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
  launchAccount: (id) => request(`/accounts/${id}/launch`, { method: 'POST' }),
  detectProfileUrl: (id) => request(`/accounts/${id}/detect-profile-url`, { method: 'POST' }),

  getStores: (platform) => request(`/stores${toQueryString({ platform })}`),
  createStore: (data) => request('/stores', { method: 'POST', body: JSON.stringify(data) }),
  updateStore: (id, data) =>
    request(`/stores/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStore: (id) => request(`/stores/${id}`, { method: 'DELETE' }),
  fetchStoreInfo: (url) =>
    request('/stores/fetch-info', { method: 'POST', body: JSON.stringify({ url }) }),
  generateStoreReceipt: (storeId, { date, count } = {}) =>
    request(`/stores/${storeId}/receipt`, {
      method: 'POST',
      body: JSON.stringify({ date: date || null, count: count || 1 }),
    }),

  getTargets: () => request('/targets'),
  createTarget: (data) => request('/targets', { method: 'POST', body: JSON.stringify(data) }),
  updateTarget: (id, data) =>
    request(`/targets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getTarget: (id) => request(`/targets/${id}`),
  deleteTarget: (id) => request(`/targets/${id}`, { method: 'DELETE' }),
  uploadTargetPhoto: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return uploadRequest(`/targets/${id}/photo`, form)
  },
  uploadTargetPhotos: (id, files) => {
    const form = new FormData()
    files.forEach((file) => form.append('files', file))
    return uploadRequest(`/targets/${id}/photos`, form)
  },
  deleteTargetPhoto: (targetId, photoId) =>
    request(`/targets/${targetId}/photos/${photoId}`, { method: 'DELETE' }),
  uploadTargetReviewTexts: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return uploadRequest(`/targets/${id}/review-texts`, form)
  },
  deleteTargetReviewText: (targetId, textId) =>
    request(`/targets/${targetId}/review-texts/${textId}`, { method: 'DELETE' }),
  previewReviewText: (data) =>
    request('/targets/preview-review-text', { method: 'POST', body: JSON.stringify(data) }),

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

  getCardRules: () => request('/card-rules'),
  createCardRule: (data) => request('/card-rules', { method: 'POST', body: JSON.stringify(data) }),
  deleteCardRule: (id) => request(`/card-rules/${id}`, { method: 'DELETE' }),
}

export const portalApi = {
  requestOtp: (phone, name) =>
    request('/portal/otp/request', { method: 'POST', body: JSON.stringify({ phone, name }) }),
  verifyOtp: (phone, code) =>
    request('/portal/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code }) }),

  devAutoLogin: () => request('/portal/dev-autologin'),

  kakaoConfig: () => request('/portal/kakao/config'),
  kakaoExchange: (code) =>
    request('/portal/kakao/exchange', { method: 'POST', body: JSON.stringify({ code }) }),
  kakaoConfirm: (data) =>
    request('/portal/kakao/confirm', { method: 'POST', body: JSON.stringify(data) }),

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

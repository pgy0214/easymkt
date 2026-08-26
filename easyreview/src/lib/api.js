export const API_ORIGIN = import.meta.env.DEV
  ? 'http://localhost:8000'
  : 'https://review-managing-production.up.railway.app'
const BASE_URL = `${API_ORIGIN}/api`
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

async function authedUploadRequest(path, token, form) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: form,
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `요청 실패 (${res.status})`)
  }
  return res.json()
}

export const api = {
  login: (username, password) =>
    request('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  getReviewers: () => request('/reviewers'),
  createReviewer: (data) =>
    request('/reviewers', { method: 'POST', body: JSON.stringify(data) }),
  createMember: (data) =>
    request('/reviewers/members', { method: 'POST', body: JSON.stringify(data) }),
  updateReviewer: (id, data) =>
    request(`/reviewers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteReviewer: (id) => request(`/reviewers/${id}`, { method: 'DELETE' }),
  fetchRecentPosts: (id) => request(`/reviewers/${id}/recent-posts`, { method: 'POST' }),

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
  bulkAssignTimeSlot: (accountIds) =>
    request('/accounts/bulk-assign-time-slot', {
      method: 'POST',
      body: JSON.stringify({ account_ids: accountIds }),
    }),

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
  updateTargetApproval: (id, status) =>
    request(`/targets/${id}/approval`, { method: 'PATCH', body: JSON.stringify({ status }) }),
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
  exportTasks: async (params = {}) => {
    const res = await fetch(`${BASE_URL}/tasks/export${toQueryString(params)}`, {
      headers: adminAuthHeader(),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `다운로드 실패 (${res.status})`)
    }
    return res.blob()
  },
  updateTaskResult: (id, resultLink) =>
    request(`/tasks/${id}/result`, {
      method: 'PATCH',
      body: JSON.stringify({ result_link: resultLink }),
    }),
  completeTask: (id) => request(`/tasks/${id}/complete`, { method: 'POST' }),
  rejectTask: (id, reason) =>
    request(`/tasks/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  updateTaskSettlement: (id, data) =>
    request(`/tasks/${id}/settlement`, { method: 'PATCH', body: JSON.stringify(data) }),
  recheckBlind: (id) => request(`/tasks/${id}/recheck-blind`, { method: 'POST' }),
  startBulkBlindCheck: (file, storeId, liveView) => {
    const form = new FormData()
    form.append('file', file)
    form.append('store_id', storeId)
    form.append('live_view', liveView ? 'true' : 'false')
    return uploadRequest('/tasks/blind-check/bulk/start', form)
  },
  getBulkBlindCheckJob: (jobId) => request(`/tasks/blind-check/bulk/${jobId}`),
  cancelBulkBlindCheckJob: (jobId) =>
    request(`/tasks/blind-check/bulk/${jobId}/cancel`, { method: 'POST' }),
  assignTask: (id, accountId) =>
    request(`/tasks/${id}/assign`, { method: 'POST', body: JSON.stringify({ account_id: accountId }) }),
  uploadTaskReceiptImage: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return uploadRequest(`/tasks/${id}/receipt-image`, form)
  },

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
  importCardRules: (file) => {
    const form = new FormData()
    form.append('file', file)
    return uploadRequest('/card-rules/import', form)
  },

  getOrders: () => request('/orders'),
  updateOrderStatus: (id, status) =>
    request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
}

export const productApi = {
  list: () => request('/products'),
  create: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  uploadThumbnail: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return uploadRequest(`/products/${id}/thumbnail`, form)
  },
  addDetailImage: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return uploadRequest(`/products/${id}/detail-images`, form)
  },
  removeDetailImage: (id, imagePath) =>
    request(`/products/${id}/detail-images`, {
      method: 'DELETE',
      body: JSON.stringify({ image_path: imagePath }),
    }),
  reorderDetailImages: (id, imagePaths) =>
    request(`/products/${id}/detail-images/order`, {
      method: 'PATCH',
      body: JSON.stringify({ image_paths: imagePaths }),
    }),
  addOption: (id, data) =>
    request(`/products/${id}/options`, { method: 'POST', body: JSON.stringify(data) }),
  updateOption: (optionId, data) =>
    request(`/products/options/${optionId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteOption: (optionId) => request(`/products/options/${optionId}`, { method: 'DELETE' }),
}

export const noticeApi = {
  list: () => request('/notices'),
  create: (data) => request('/notices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/notices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => request(`/notices/${id}`, { method: 'DELETE' }),
  uploadImage: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return uploadRequest(`/notices/${id}/image`, form)
  },
}

export const experienceCampaignApi = {
  list: () => request('/experience-campaigns'),
  create: (data) => request('/experience-campaigns', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/experience-campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => request(`/experience-campaigns/${id}`, { method: 'DELETE' }),
  uploadImage: (id, file) => {
    const form = new FormData()
    form.append('file', file)
    return uploadRequest(`/experience-campaigns/${id}/image`, form)
  },
  getCandidates: (id) => request(`/experience-campaigns/${id}/candidates`),
  scout: (id, reviewerIds) =>
    request(`/experience-campaigns/${id}/scout`, {
      method: 'POST',
      body: JSON.stringify({ reviewer_ids: reviewerIds }),
    }),
  updateApproval: (id, status) =>
    request(`/experience-campaigns/${id}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getApplications: (id) => request(`/experience-campaigns/${id}/applications`),
  updateApplicationStatus: (applicationId, status) =>
    request(`/experience-campaigns/applications/${applicationId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}

export const portalApi = {
  requestOtp: (phone) =>
    request('/portal/otp/request', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone, code) =>
    request('/portal/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code }) }),
  login: (username, password) =>
    request('/portal/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  completeSignup: (token, data) =>
    authedRequest('/portal/me/complete-signup', token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  resetPassword: (token) =>
    authedRequest('/portal/me/reset-password', token, { method: 'POST' }),
  updateProfile: (token, data) =>
    authedRequest('/portal/me/profile', token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  uploadBusinessRegistrationImage: (token, file) => {
    const form = new FormData()
    form.append('file', file)
    return authedUploadRequest('/portal/me/business-registration-image', token, form)
  },

  devAutoLogin: () => request('/portal/dev-autologin'),

  kakaoConfig: () => request('/portal/kakao/config'),
  kakaoExchange: (code) =>
    request('/portal/kakao/exchange', { method: 'POST', body: JSON.stringify({ code }) }),
  kakaoConfirm: (data) =>
    request('/portal/kakao/confirm', { method: 'POST', body: JSON.stringify(data) }),

  me: (token) => authedRequest('/portal/me', token),
  updateMyBlogUrl: (token, blogUrl, blogIndex, email) =>
    authedRequest('/portal/me/blog-url', token, {
      method: 'PATCH',
      body: JSON.stringify({ blog_url: blogUrl, blog_index: blogIndex || null, email: email ?? null }),
    }),
  addAccount: (token, data) =>
    authedRequest('/portal/accounts', token, { method: 'POST', body: JSON.stringify(data) }),
  deleteAccount: (token, id) => authedRequest(`/portal/accounts/${id}`, token, { method: 'DELETE' }),

  getPool: (token) => authedRequest('/portal/pool', token),
  checkAvailability: (token) =>
    authedRequest('/portal/accounts/check-availability', token, { method: 'POST' }),
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

  getExperienceCampaigns: (token) => authedRequest('/portal/experience/campaigns', token),
  applyToExperienceCampaign: (token, campaignId) =>
    authedRequest(`/portal/experience/campaigns/${campaignId}/apply`, token, { method: 'POST' }),
}

export const advertiserApi = {
  me: (token) => authedRequest('/advertiser/me', token),
  fetchStoreInfo: (token, url) =>
    authedRequest('/advertiser/stores/fetch-info', token, {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),
  getStores: (token) => authedRequest('/advertiser/stores', token),
  createStore: (token, data) =>
    authedRequest('/advertiser/stores', token, { method: 'POST', body: JSON.stringify(data) }),
  updateStore: (token, id, data) =>
    authedRequest(`/advertiser/stores/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) }),
  getProducts: (token) => authedRequest('/advertiser/products', token),
  getNotices: (token) => authedRequest('/advertiser/notices', token),

  getCampaigns: (token) => authedRequest('/advertiser/campaigns', token),
  createCampaign: (token, data) =>
    authedRequest('/advertiser/campaigns', token, { method: 'POST', body: JSON.stringify(data) }),
  deleteCampaign: (token, id) =>
    authedRequest(`/advertiser/campaigns/${id}`, token, { method: 'DELETE' }),

  getReviewTargets: (token) => authedRequest('/advertiser/review-targets', token),
  createReviewTarget: (token, data) =>
    authedRequest('/advertiser/review-targets', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteReviewTarget: (token, id) =>
    authedRequest(`/advertiser/review-targets/${id}`, token, { method: 'DELETE' }),
  previewReviewText: (token, data) =>
    authedRequest('/advertiser/review-targets/preview-review-text', token, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  uploadReviewTargetReviewTexts: (token, id, file) => {
    const form = new FormData()
    form.append('file', file)
    return authedUploadRequest(`/advertiser/review-targets/${id}/review-texts`, token, form)
  },
  uploadReviewTargetPhotos: (token, id, files) => {
    const form = new FormData()
    files.forEach((file) => form.append('files', file))
    return authedUploadRequest(`/advertiser/review-targets/${id}/photos`, token, form)
  },
}

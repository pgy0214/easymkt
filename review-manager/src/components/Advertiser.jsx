import { Loader2, LogOut, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { advertiserApi, portalApi } from '../lib/api.js'
import { formatBusinessNumber, formatUtcToLocalDate, localDateToUtcNaiveIso } from '../lib/format.js'
import ProductRowsEditor from './ProductRowsEditor.jsx'
import Badge from './ui/Badge.jsx'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'

const TOKEN_KEY = 'advertiser_token'

export default function Advertiser() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))

  if (!token) {
    return (
      <LoginFlow
        onLoggedIn={(t) => {
          localStorage.setItem(TOKEN_KEY, t)
          setToken(t)
        }}
      />
    )
  }

  return (
    <AdvertiserHome
      token={token}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      }}
    />
  )
}

function LoginFlow({ onLoggedIn }) {
  const [step, setStep] = useState('login') // 'login' | 'phone' | 'code' | 'complete-signup'
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pendingToken, setPendingToken] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  const [signupUsername, setSignupUsername] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupConsent, setSignupConsent] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await portalApi.login(username.trim(), password)
      onLoggedIn(result.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestOtp(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await portalApi.requestOtp(phone.trim())
      setMessage('인증번호를 보냈습니다. 문자로 받은 6자리 번호를 입력해주세요.')
      setStep('code')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await portalApi.verifyOtp(phone.trim(), code.trim())
      if (result.needs_signup) {
        setPendingToken(result.token)
        setStep('complete-signup')
      } else {
        setError('이미 가입된 전화번호입니다. 로그인 화면에서 아이디/비밀번호로 로그인해주세요.')
        setStep('login')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCompleteSignup(e) {
    e.preventDefault()
    if (!signupConsent) {
      setError('개인정보 수집·이용에 동의해야 가입할 수 있어요.')
      return
    }
    if (signupPassword.length < 4) {
      setError('비밀번호는 4자 이상이어야 해요.')
      return
    }
    if (signupPassword !== signupPasswordConfirm) {
      setError('비밀번호가 서로 달라요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const result = await portalApi.completeSignup(pendingToken, {
        username: signupUsername.trim(),
        password: signupPassword,
        name: signupName.trim(),
        privacy_consent: signupConsent,
        marketing_consent: false,
        category: 'advertiser',
      })
      onLoggedIn(result.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const TITLE_BY_STEP = {
    login: '로그인',
    phone: '본인확인',
    code: '본인확인',
    'complete-signup': '회원가입',
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-card border border-gray-200 bg-white p-6">
      <img src="/logo.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
      <h1 className="mb-4 text-center text-lg font-semibold text-gray-900">
        이지리뷰 <span className="font-normal text-gray-400">광고주 {TITLE_BY_STEP[step]}</span>
      </h1>

      {step === 'login' && (
        <form onSubmit={handleLogin} className="space-y-3">
          <Input label="아이디" value={username} onChange={(e) => setUsername(e.target.value)} />
          <Input
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            로그인
          </Button>
          {error && <p className="text-sm text-danger-text">{error}</p>}
          <button
            type="button"
            onClick={() => {
              setStep('phone')
              setError(null)
              setMessage(null)
            }}
            className="w-full text-center text-xs text-gray-400 underline hover:text-gray-600"
          >
            처음이신가요? 전화번호로 광고주 회원가입
          </button>
        </form>
      )}

      {step === 'phone' && (
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <button
            type="button"
            onClick={() => setStep('login')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← 로그인 화면으로
          </button>
          <Input
            label="전화번호"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
          />
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            인증번호 받기
          </Button>
          {error && <p className="text-sm text-danger-text">{error}</p>}
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleVerify} className="space-y-3">
          {message && <p className="text-sm text-success-text">{message}</p>}
          <Input label="인증번호 (6자리)" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            확인
          </Button>
          {error && <p className="text-sm text-danger-text">{error}</p>}
        </form>
      )}

      {step === 'complete-signup' && (
        <form onSubmit={handleCompleteSignup} className="space-y-3">
          <Input
            label="아이디"
            value={signupUsername}
            onChange={(e) => setSignupUsername(e.target.value)}
            placeholder="영문 소문자/숫자 4~20자"
          />
          <Input
            label="비밀번호"
            type="password"
            value={signupPassword}
            onChange={(e) => setSignupPassword(e.target.value)}
          />
          <Input
            label="비밀번호 확인"
            type="password"
            value={signupPasswordConfirm}
            onChange={(e) => setSignupPasswordConfirm(e.target.value)}
          />
          <Input label="이름 / 업체 담당자명" value={signupName} onChange={(e) => setSignupName(e.target.value)} />
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={signupConsent}
              onChange={(e) => setSignupConsent(e.target.checked)}
            />
            개인정보 수집·이용에 동의합니다
          </label>
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            가입 완료
          </Button>
          {error && <p className="text-sm text-danger-text">{error}</p>}
        </form>
      )}
    </div>
  )
}

const CAMPAIGN_TYPES = ['방문형', '배송형']
const CONTENT_TYPES = ['블로그', '인스타그램', '유튜브', '틱톡']

const EMPTY_STORE = { platform: 'naver', url: '' }

const EMPTY_CAMPAIGN = {
  store_id: '',
  campaign_type: '방문형',
  content_type: '블로그',
  product_name: '',
  capacity: 5,
  recruit_start: '',
  recruit_end: '',
  content_guide: '',
}

const APPROVAL_LABEL = { approved: '승인됨 (노출중)', pending: '승인대기중', rejected: '거절됨' }
const APPROVAL_VARIANT = { approved: 'success', pending: 'warning', rejected: 'danger' }

function AdvertiserHome({ token, onLogout }) {
  const [stores, setStores] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [storeModalOpen, setStoreModalOpen] = useState(false)
  const [campaignModalOpen, setCampaignModalOpen] = useState(false)
  const [storeForm, setStoreForm] = useState(EMPTY_STORE)
  const [fetching, setFetching] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [fetched, setFetched] = useState(null) // { name, address, representative_hours, representative_product }
  const [productInput, setProductInput] = useState('')
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('')
  const [representativeName, setRepresentativeName] = useState('')
  const [phone, setPhone] = useState('')
  // ProductRowsEditor는 마운트 시점에만 value를 행으로 파싱하므로, 새 URL을
  // 조회할 때마다 key를 바꿔 강제로 다시 마운트시켜야 그 값이 반영된다.
  const [productEditorKey, setProductEditorKey] = useState(0)
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function refresh() {
    setLoading(true)
    try {
      const [storeList, campaignList] = await Promise.all([
        advertiserApi.getStores(token),
        advertiserApi.getCampaigns(token),
      ])
      setStores(storeList)
      setCampaigns(campaignList)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetStoreForm() {
    setStoreForm(EMPTY_STORE)
    setFetched(null)
    setFetchError(null)
    setProductInput('')
    setBusinessRegistrationNumber('')
    setRepresentativeName('')
    setPhone('')
    setProductEditorKey((k) => k + 1)
  }

  async function handleFetchStoreInfo() {
    const url = storeForm.url.trim()
    if (!url) return
    if (storeForm.platform !== 'naver') {
      setFetchError('카카오맵은 아직 자동입력을 지원하지 않아요.')
      return
    }
    setFetching(true)
    setFetchError(null)
    setFetched(null)
    try {
      const info = await advertiserApi.fetchStoreInfo(token, url)
      setFetched(info)
      setProductInput(info.representative_product || '')
      setProductEditorKey((k) => k + 1)
      if (!info.name) {
        setFetchError('매장명을 찾지 못했어요. URL이 맞는지 확인하고 다시 시도해주세요.')
      }
    } catch (err) {
      setFetchError(err.message)
    } finally {
      setFetching(false)
    }
  }

  const businessInfoComplete = businessRegistrationNumber.trim() && representativeName.trim() && phone.trim()

  async function handleCreateStore() {
    if (!fetched || !fetched.name || !businessInfoComplete) return
    setSubmitting(true)
    setError(null)
    try {
      await advertiserApi.createStore(token, {
        platform: storeForm.platform,
        name: fetched.name,
        url: storeForm.url.trim(),
        address: fetched.address || null,
        representative_hours: fetched.representative_hours || null,
        representative_product: productInput.trim() || null,
        business_registration_number: businessRegistrationNumber.trim() || null,
        representative_name: representativeName.trim() || null,
        phone: phone.trim() || null,
      })
      setStoreModalOpen(false)
      resetStoreForm()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateCampaign(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await advertiserApi.createCampaign(token, {
        ...campaignForm,
        store_id: Number(campaignForm.store_id),
        capacity: Number(campaignForm.capacity),
        recruit_start: localDateToUtcNaiveIso(campaignForm.recruit_start),
        recruit_end: localDateToUtcNaiveIso(campaignForm.recruit_end, true),
      })
      setCampaignModalOpen(false)
      setCampaignForm(EMPTY_CAMPAIGN)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteCampaign(id) {
    if (!confirm('이 캠페인을 삭제할까요?')) return
    await advertiserApi.deleteCampaign(token, id)
    await refresh()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
          <h1 className="text-lg font-semibold text-gray-900">이지리뷰 광고주센터</h1>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <LogOut size={14} />
          로그아웃
        </button>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">내 매장</h2>
          <Button
            size="sm"
            onClick={() => {
              resetStoreForm()
              setStoreModalOpen(true)
            }}
          >
            <Plus size={14} className="mr-1 inline" />
            매장 등록
          </Button>
        </div>
        {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
        {!loading && stores.length === 0 && (
          <p className="text-sm text-gray-400">등록된 매장이 없습니다. 먼저 매장을 등록해주세요.</p>
        )}
        {stores.length > 0 && (
          <div className="space-y-2">
            {stores.map((s) => (
              <div key={s.id} className="rounded-btn border border-gray-200 p-3">
                <div className="font-medium text-gray-800">{s.name}</div>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">
                  {s.url}
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">내 캠페인</h2>
          <Button size="sm" onClick={() => setCampaignModalOpen(true)} disabled={stores.length === 0}>
            <Plus size={14} className="mr-1 inline" />
            캠페인 개설
          </Button>
        </div>
        {stores.length === 0 && (
          <p className="text-sm text-gray-400">캠페인을 개설하려면 먼저 매장을 등록해주세요.</p>
        )}
        {stores.length > 0 && campaigns.length === 0 && !loading && (
          <p className="text-sm text-gray-400">등록된 캠페인이 없습니다</p>
        )}
        {campaigns.length > 0 && (
          <div className="space-y-2">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-btn border border-gray-200 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{c.store_name}</span>
                    <Badge variant={APPROVAL_VARIANT[c.approval_status]}>{APPROVAL_LABEL[c.approval_status]}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {c.product_name} · 신청 {c.applicant_count}/{c.capacity}명 · {formatUtcToLocalDate(c.recruit_start)} ~ {formatUtcToLocalDate(c.recruit_end)}
                  </p>
                </div>
                <button onClick={() => handleDeleteCampaign(c.id)} className="text-gray-400 hover:text-danger-text" title="캠페인 삭제">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {storeModalOpen && (
        <Modal open onClose={() => setStoreModalOpen(false)}>
          <h3 className="mb-3 font-semibold text-gray-800">매장 등록</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500">플랫폼</label>
              <select
                value={storeForm.platform}
                onChange={(e) => {
                  resetStoreForm()
                  setStoreForm((prev) => ({ ...prev, platform: e.target.value }))
                }}
                className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              >
                <option value="naver">네이버영수증</option>
                <option value="kakao">카카오맵</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500">매장 URL</label>
              <div className="flex gap-1">
                <Input
                  value={storeForm.url}
                  onChange={(e) => {
                    setStoreForm((prev) => ({ ...prev, url: e.target.value }))
                    setFetched(null)
                    setFetchError(null)
                  }}
                  placeholder="https://naver.me/..."
                  className="w-full"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleFetchStoreInfo}
                  disabled={fetching || !storeForm.url.trim()}
                  className="shrink-0"
                >
                  {fetching && <Loader2 size={12} className="animate-spin" />}
                  {fetching ? '가져오는 중...' : '입력완료'}
                </Button>
              </div>
              {fetching && (
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                  <Loader2 size={12} className="animate-spin" />
                  네이버에서 매장 정보를 가져오고 있어요 (몇 초 걸릴 수 있어요)...
                </p>
              )}
            </div>

            {fetchError && <p className="text-xs text-danger-text">{fetchError}</p>}

            {fetched && (
              <div className="space-y-3 rounded-btn border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500">
                  아래 내용은 네이버에서 가져온 정보라 직접 수정할 수 없어요 (대표상품 제외). URL이
                  잘못됐다면 위에서 URL을 고치고 "입력완료"를 다시 눌러주세요.
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <span className="block text-xs text-gray-500">매장명</span>
                    <p className="text-sm text-gray-800">{fetched.name || '-'}</p>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">매장주소</span>
                    <p className="text-sm text-gray-800">{fetched.address || '-'}</p>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">대표시간</span>
                    <p className="text-sm text-gray-800">{fetched.representative_hours || '-'}</p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-gray-200 pt-3">
                  <p className="text-xs text-gray-500">영수증 생성에 쓰이는 사업자 정보 (필수)</p>
                  <Input
                    value={businessRegistrationNumber}
                    onChange={(e) => setBusinessRegistrationNumber(formatBusinessNumber(e.target.value))}
                    placeholder="사업자번호 (예: 250-07-00453)"
                    className="w-full"
                  />
                  <Input
                    value={representativeName}
                    onChange={(e) => setRepresentativeName(e.target.value)}
                    placeholder="대표자명"
                    className="w-full"
                  />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="전화번호 (예: 0507-1412-5171)"
                    className="w-full"
                  />
                </div>

                <div>
                  <span className="block text-xs text-gray-500">대표상품</span>
                  {fetched.representative_product ? (
                    <p className="text-sm text-gray-800">{fetched.representative_product}</p>
                  ) : (
                    <>
                      <p className="text-xs text-amber-600">
                        *플레이스에 등록된 정보를 찾을 수가 없습니다 직접 입력해주세요.
                      </p>
                      <div className="mt-1">
                        <ProductRowsEditor key={productEditorKey} value={productInput} onChange={setProductInput} />
                      </div>
                    </>
                  )}
                </div>

                {error && <p className="text-sm text-danger-text">{error}</p>}
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCreateStore}
                  disabled={submitting || !fetched.name || !businessInfoComplete}
                  className="w-full"
                >
                  {submitting ? '등록 중...' : '확인, 이 정보로 매장 등록'}
                </Button>
                {!businessInfoComplete && (
                  <p className="text-xs text-gray-400">
                    사업자번호/대표자명/전화번호를 모두 입력해야 등록할 수 있어요.
                  </p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {campaignModalOpen && (
        <Modal open onClose={() => setCampaignModalOpen(false)}>
          <h3 className="mb-3 font-semibold text-gray-800">캠페인 개설</h3>
          <p className="mb-3 text-xs text-gray-500">캠페인은 등록 후 관리자 승인이 완료되면 리뷰어에게 노출됩니다.</p>
          <form onSubmit={handleCreateCampaign} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500">매장</label>
              <select
                value={campaignForm.store_id}
                onChange={(e) => setCampaignForm({ ...campaignForm, store_id: e.target.value })}
                className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                required
              >
                <option value="">선택해주세요</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500">캠페인 유형</label>
                <select
                  value={campaignForm.campaign_type}
                  onChange={(e) => setCampaignForm({ ...campaignForm, campaign_type: e.target.value })}
                  className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                >
                  {CAMPAIGN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500">콘텐츠 유형</label>
                <select
                  value={campaignForm.content_type}
                  onChange={(e) => setCampaignForm({ ...campaignForm, content_type: e.target.value })}
                  className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Input label="캠페인 상품" value={campaignForm.product_name} onChange={(e) => setCampaignForm({ ...campaignForm, product_name: e.target.value })} required />
            <Input
              label="모집 인원"
              type="number"
              value={campaignForm.capacity}
              onChange={(e) => setCampaignForm({ ...campaignForm, capacity: e.target.value })}
              required
            />
            <div className="flex gap-2">
              <Input
                label="모집 시작일"
                type="date"
                value={campaignForm.recruit_start}
                onChange={(e) => setCampaignForm({ ...campaignForm, recruit_start: e.target.value })}
                required
              />
              <Input
                label="모집 종료일"
                type="date"
                value={campaignForm.recruit_end}
                onChange={(e) => setCampaignForm({ ...campaignForm, recruit_end: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500">가이드라인 (선택)</label>
              <textarea
                value={campaignForm.content_guide}
                onChange={(e) => setCampaignForm({ ...campaignForm, content_guide: e.target.value })}
                rows={4}
                className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              />
            </div>
            {error && <p className="text-sm text-danger-text">{error}</p>}
            <Button type="submit" variant="primary" disabled={submitting} className="w-full">
              캠페인 개설
            </Button>
          </form>
        </Modal>
      )}
    </div>
  )
}

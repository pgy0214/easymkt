import { Loader2, LogOut, Plus, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { advertiserApi, api, API_ORIGIN, portalApi } from '../lib/api.js'
import {
  enforceProductNameLength,
  formatBusinessNumber,
  formatDate,
  formatUtcToLocalDate,
  localDateToUtcNaiveIso,
  MAX_PRODUCT_NAME_LENGTH,
  parseProductString,
  WEEKDAY_LABELS,
} from '../lib/format.js'
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
  const [step, setStep] = useState('login') // 'login' | 'phone' | 'code' | 'complete-signup' | 'business-registration'
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
  const [businessRegFile, setBusinessRegFile] = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await portalApi.login(username.trim(), password)
      const me = await advertiserApi.me(result.token)
      if (me.category !== 'advertiser') {
        setError('광고주 권한이 없는 계정입니다. 관리자에게 문의해주세요.')
        return
      }
      onLoggedIn(result.token)
    } catch (err) {
      // 광고주 계정이 아니면, 관리자 계정으로 들어온 건 아닌지 한 번 더 확인 —
      // 관리자가 이 도메인으로 들어와도 헤매지 않고 바로 /admin으로 넘어가게 한다.
      try {
        const adminResult = await api.login(username.trim(), password)
        localStorage.setItem('admin_token', adminResult.token)
        window.location.href = '/admin'
        return
      } catch {
        setError(err.message)
      }
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
      await portalApi.completeSignup(pendingToken, {
        username: signupUsername.trim(),
        password: signupPassword,
        name: signupName.trim(),
        privacy_consent: signupConsent,
        marketing_consent: false,
        category: 'advertiser',
      })
      setStep('business-registration')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUploadBusinessRegistration(e) {
    e.preventDefault()
    if (!businessRegFile) {
      setError('사업자등록증 이미지를 선택해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await portalApi.uploadBusinessRegistrationImage(pendingToken, businessRegFile)
      onLoggedIn(pendingToken)
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
    'business-registration': '사업자등록증 제출',
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

      {step === 'business-registration' && (
        <form onSubmit={handleUploadBusinessRegistration} className="space-y-3">
          <p className="text-xs text-gray-500">
            사업자등록증 이미지를 첨부해주세요. 관리자가 확인 후 승인해야 매장 등록과
            캠페인 개설이 가능해요. 가입 자체는 지금 완료됩니다.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setBusinessRegFile(e.target.files?.[0] || null)}
            className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          />
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            {submitting ? '제출 중...' : '제출하고 계속하기'}
          </Button>
          {error && <p className="text-sm text-danger-text">{error}</p>}
        </form>
      )}
    </div>
  )
}

const CAMPAIGN_TYPES = ['방문형', '배송형']
const CONTENT_TYPES = ['블로그', '인스타그램', '유튜브', '틱톡']

const EMPTY_STORE = { url: '' }

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

// --- 영수증리뷰 캠페인(ReviewTarget) 등록 — 관리자 "캠페인관리"의 등록폼과 동일한 필드 ---

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const REVIEW_LENGTH_OPTIONS = [50, 80, 100]
const EMPTY_MENU_ITEM = { name: '', price: '' }

const DEFAULT_GUIDELINE = [
  '1) 한잔 하기 좋고, 칵테일, 위스키메뉴가 많았다.',
  '2) 특이한 칵테일을 먹어보고 싶다면 시그니처 메뉴 칵테일을 먹어봐라.',
  '3) 인스타에 칵테일 사진 올리기 좋다.',
  '4) 외국인들이 많이 방문하는 듯 했다.(동남아, 유럽, 미국 등 다양함)',
  '5) 부산역 바로 옆이라 기차타러 가기전 후에 한번쯤 가보기 좋음.',
].join('\n')

const EMPTY_REVIEW_TARGET = {
  store_id: '',
  unit_price: 0,
  sale_price: '',
  daily_limit: 1,
  start_date: '',
  end_date: '',
  work_days: ALL_DAYS,
  guideline: DEFAULT_GUIDELINE,
  regional_features: '',
  menu_items: [{ ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }],
  review_length: 80,
  photos_per_review: 1,
}

function menuItemsFromStore(store) {
  const items = parseProductString(store?.representative_product)
  if (items.length === 0) return null
  return [0, 1, 2].map((i) =>
    items[i] ? { name: items[i].name.slice(0, MAX_PRODUCT_NAME_LENGTH), price: items[i].price } : { ...EMPTY_MENU_ITEM },
  )
}

function daysBetween(start, end) {
  if (!start || !end) return null
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1
  return days > 0 ? days : null
}

// work_days는 백엔드와 동일하게 0=월..6=일 — JS Date.getDay()(0=일..6=토)를 변환해서 맞춘다
function countMatchingDays(startDate, endDate, workDays) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end < start) return 0
  let count = 0
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const mondayBased = (d.getDay() + 6) % 7
    if (workDays.includes(mondayBased)) count++
  }
  return count
}

function AdvertiserHome({ token, onLogout }) {
  const [me, setMe] = useState(null)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
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

  // 캠페인 개설 모달에서 고르는 유형: 체험단(ExperienceCampaign) vs 영수증리뷰(ReviewTarget)
  const [campaignKind, setCampaignKind] = useState('experience')
  const [reviewTargets, setReviewTargets] = useState([])
  const [reviewTargetForm, setReviewTargetForm] = useState(EMPTY_REVIEW_TARGET)
  const [usePhotos, setUsePhotos] = useState(false)
  const [photoFiles, setPhotoFiles] = useState([])
  const [reviewTextFile, setReviewTextFile] = useState(null)
  const [previewText, setPreviewText] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const photoInputRef = useRef(null)
  const reviewTextInputRef = useRef(null)

  async function refresh() {
    setLoading(true)
    try {
      const [meInfo, storeList, campaignList, reviewTargetList] = await Promise.all([
        advertiserApi.me(token),
        advertiserApi.getStores(token),
        advertiserApi.getCampaigns(token),
        advertiserApi.getReviewTargets(token),
      ])
      setMe(meInfo)
      setStores(storeList)
      setCampaigns(campaignList)
      setReviewTargets(reviewTargetList)
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
        platform: 'naver',
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

  function resetReviewTargetForm() {
    setReviewTargetForm(EMPTY_REVIEW_TARGET)
    setUsePhotos(false)
    setPhotoFiles([])
    setReviewTextFile(null)
    setPreviewText(null)
  }

  function handleReviewTargetStoreChange(storeId) {
    const selected = stores.find((s) => s.id === Number(storeId))
    setReviewTargetForm((prev) => ({
      ...prev,
      store_id: storeId,
      menu_items: menuItemsFromStore(selected) ?? [{ ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }],
    }))
  }

  function toggleReviewTargetWorkDay(day) {
    setReviewTargetForm((prev) => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter((d) => d !== day)
        : [...prev.work_days, day],
    }))
  }

  function updateReviewTargetMenuItem(index, field, value) {
    setReviewTargetForm((prev) => ({
      ...prev,
      menu_items: prev.menu_items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  async function handlePreviewReviewText() {
    setPreviewing(true)
    setPreviewText(null)
    try {
      const menuItems = reviewTargetForm.menu_items
        .filter((item) => item.name.trim() && item.price !== '')
        .map((item) => ({ name: item.name.trim(), price: Number(item.price) }))
      const result = await advertiserApi.previewReviewText(token, {
        guideline: reviewTargetForm.guideline.trim() || null,
        regional_features: reviewTargetForm.regional_features.trim() || null,
        review_length: Number(reviewTargetForm.review_length),
        menu_items: menuItems.length > 0 ? menuItems : null,
      })
      setPreviewText(result.text)
    } catch (err) {
      alert(err.message)
    } finally {
      setPreviewing(false)
    }
  }

  const reviewTargetDayCount = daysBetween(reviewTargetForm.start_date, reviewTargetForm.end_date)
  const reviewTargetMatchingDays = countMatchingDays(
    reviewTargetForm.start_date,
    reviewTargetForm.end_date,
    reviewTargetForm.work_days,
  )
  const reviewTargetTotalCount = reviewTargetMatchingDays * (Number(reviewTargetForm.daily_limit) || 0)
  const selectedReviewTargetStore = stores.find((s) => s.id === Number(reviewTargetForm.store_id))

  async function handleCreateReviewTarget(e) {
    e.preventDefault()
    if (!reviewTargetForm.store_id) {
      setError('매장을 선택해주세요.')
      return
    }
    if (reviewTargetForm.work_days.length === 0) {
      setError('작업요일을 최소 하루 이상 선택해주세요.')
      return
    }
    if (!reviewTargetForm.start_date || !reviewTargetForm.end_date) {
      setError('작업 기간(시작일~종료일)을 입력해주세요 — 총 건수 계산에 필요합니다.')
      return
    }
    if (reviewTargetTotalCount <= 0) {
      setError('작업 기간/작업요일/1일 작업 갯수를 확인해주세요 — 총 건수가 0건입니다.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const menuItems = reviewTargetForm.menu_items
        .filter((item) => item.name.trim() && item.price !== '')
        .map((item) => ({ name: item.name.trim(), price: Number(item.price) }))
      const target = await advertiserApi.createReviewTarget(token, {
        store_id: Number(reviewTargetForm.store_id),
        required_count: reviewTargetTotalCount,
        unit_price: Number(reviewTargetForm.unit_price),
        sale_price: reviewTargetForm.sale_price === '' ? null : Number(reviewTargetForm.sale_price),
        work_days: reviewTargetForm.work_days,
        daily_limit: Number(reviewTargetForm.daily_limit),
        start_date: reviewTargetForm.start_date || null,
        end_date: reviewTargetForm.end_date || null,
        guideline: reviewTargetForm.guideline.trim() || null,
        regional_features: reviewTargetForm.regional_features.trim() || null,
        menu_items: menuItems.length > 0 ? menuItems : null,
        review_length: Number(reviewTargetForm.review_length),
        photos_per_review: usePhotos ? Number(reviewTargetForm.photos_per_review) || 1 : 0,
      })
      if (reviewTextFile) {
        await advertiserApi.uploadReviewTargetReviewTexts(token, target.id, reviewTextFile)
      }
      if (usePhotos && photoFiles.length > 0) {
        await advertiserApi.uploadReviewTargetPhotos(token, target.id, photoFiles)
      }
      setCampaignModalOpen(false)
      resetReviewTargetForm()
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteReviewTarget(id) {
    if (!confirm('이 캠페인을 삭제할까요? (클레임되었거나 완료된 작업이 있으면 삭제할 수 없습니다)')) return
    try {
      await advertiserApi.deleteReviewTarget(token, id)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
          <h1 className="text-lg font-semibold text-gray-900">이지리뷰 광고주센터</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setProfileModalOpen(true)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            내 정보 수정
          </button>
          <button onClick={onLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      </div>

      {profileModalOpen && me && (
        <ProfileEditModal
          token={token}
          me={me}
          onClose={() => setProfileModalOpen(false)}
          onUpdated={refresh}
        />
      )}

      {me && !me.is_active && (
        <div className="rounded-card border border-amber-200 bg-warning-bg px-3 py-2 text-sm text-warning-text">
          사업자등록증 승인 대기 중입니다. 관리자 확인 후 매장 등록과 캠페인 개설이 가능해요.
        </div>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">내 매장</h2>
          <Button
            size="sm"
            disabled={me && !me.is_active}
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
          <Button
            size="sm"
            onClick={() => {
              setError(null)
              setCampaignKind('experience')
              setCampaignForm(EMPTY_CAMPAIGN)
              resetReviewTargetForm()
              setCampaignModalOpen(true)
            }}
            disabled={stores.length === 0}
          >
            <Plus size={14} className="mr-1 inline" />
            캠페인 개설
          </Button>
        </div>
        {stores.length === 0 && (
          <p className="text-sm text-gray-400">캠페인을 개설하려면 먼저 매장을 등록해주세요.</p>
        )}
        {stores.length > 0 && campaigns.length === 0 && reviewTargets.length === 0 && !loading && (
          <p className="text-sm text-gray-400">등록된 캠페인이 없습니다</p>
        )}
        {(campaigns.length > 0 || reviewTargets.length > 0) && (
          <div className="space-y-4">
            {campaigns.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">체험단</p>
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
              </div>
            )}
            {reviewTargets.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-500">영수증리뷰</p>
                <div className="space-y-2">
                  {reviewTargets.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-btn border border-gray-200 p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">{t.store_name}</span>
                          <Badge variant={t.completed_count >= t.required_count ? 'success' : 'info'}>
                            {t.completed_count >= t.required_count ? '완료' : '진행중'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">
                          완료 {t.completed_count}/{t.required_count}건 · 건당 {t.unit_price.toLocaleString()}원 ·{' '}
                          {formatDate(t.start_date)} ~ {formatDate(t.end_date)}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteReviewTarget(t.id)} className="text-gray-400 hover:text-danger-text" title="캠페인 삭제">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {storeModalOpen && (
        <Modal open onClose={() => setStoreModalOpen(false)}>
          <h3 className="mb-3 font-semibold text-gray-800">매장 등록</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500">매장 URL</label>
              <p className="mb-1 text-xs text-gray-400">네이버 스마트플레이스 URL을 넣어주세요.</p>
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
                  아래 내용은 네이버에서 가져온 정보라 직접 수정할 수 없어요 (대표상품 제외).
                  <br />
                  URL이 잘못됐다면 위에서 URL을 고치고 "입력완료"를 다시 눌러주세요.
                </p>
                <div className="space-y-2">
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
        <Modal open onClose={() => setCampaignModalOpen(false)} size={campaignKind === 'review' ? 'lg' : 'md'}>
          <h3 className="mb-3 font-semibold text-gray-800">캠페인 개설</h3>

          <div className="mb-3 flex gap-1 rounded-btn bg-gray-100 p-0.5">
            {[
              { value: 'experience', label: '체험단' },
              { value: 'review', label: '영수증리뷰' },
            ].map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => {
                  setError(null)
                  setCampaignKind(k.value)
                }}
                className={`flex-1 rounded-btn px-2 py-1.5 text-sm font-medium transition-colors ${
                  campaignKind === k.value ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          {campaignKind === 'experience' && (
            <>
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
            </>
          )}

          {campaignKind === 'review' && (
            <>
              <p className="mb-3 text-xs text-gray-500">
                등록된 작업은 자동 배정되지 않고 오픈풀에 공개되며, 리뷰어가 셀프서비스 포털에서 직접
                클레임합니다.
              </p>
              <form onSubmit={handleCreateReviewTarget} className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500">매장</label>
                  <select
                    value={reviewTargetForm.store_id}
                    onChange={(e) => handleReviewTargetStoreChange(e.target.value)}
                    className="w-full rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
                  >
                    <option value="">선택해주세요</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500">리뷰어 단가 (원)</label>
                    <Input
                      type="number"
                      min="0"
                      value={reviewTargetForm.unit_price}
                      onChange={(e) => setReviewTargetForm({ ...reviewTargetForm, unit_price: e.target.value })}
                      className="w-full"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500">판매단가 (원, 선택)</label>
                    <Input
                      type="number"
                      min="0"
                      value={reviewTargetForm.sale_price}
                      onChange={(e) => setReviewTargetForm({ ...reviewTargetForm, sale_price: e.target.value })}
                      placeholder="비워두면 매출 집계에서 제외"
                      className="w-full"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500">작업 기간 (총 건수 계산에 사용됩니다)</label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="date"
                      value={reviewTargetForm.start_date}
                      onChange={(e) => setReviewTargetForm({ ...reviewTargetForm, start_date: e.target.value })}
                    />
                    <span className="text-xs text-gray-400">~</span>
                    <Input
                      type="date"
                      value={reviewTargetForm.end_date}
                      onChange={(e) => setReviewTargetForm({ ...reviewTargetForm, end_date: e.target.value })}
                    />
                    {reviewTargetDayCount != null && (
                      <span className="text-xs font-medium text-gray-500">{reviewTargetDayCount}일간</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500">작업요일 (선택한 요일에만 오픈풀에 노출)</label>
                  <div className="mt-1 flex gap-1">
                    {WEEKDAY_LABELS.map((label, day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleReviewTargetWorkDay(day)}
                        className={`h-7 w-7 rounded text-xs font-medium ${
                          reviewTargetForm.work_days.includes(day)
                            ? 'bg-brand-500 text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500">1일 작업 갯수 (하루에 이만큼만 오픈풀에서 클레임 가능)</label>
                  <Input
                    type="number"
                    min="1"
                    value={reviewTargetForm.daily_limit}
                    onChange={(e) => setReviewTargetForm({ ...reviewTargetForm, daily_limit: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div className="rounded-card border border-brand-100 bg-brand-50 p-2">
                  <label className="block text-xs text-gray-500">건수 (작업기간 × 작업요일 × 1일 작업 갯수로 자동 계산)</label>
                  <input
                    type="number"
                    value={reviewTargetTotalCount}
                    disabled
                    className="w-full rounded-btn border border-gray-200 bg-gray-100 px-2 py-1 text-sm text-gray-500"
                  />
                </div>
                <div className="space-y-3 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-500">
                    리뷰 원고 자료 (리뷰어가 포털에서 "리뷰 자료 보기"로 확인)
                  </p>
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-xs text-gray-500">
                        리뷰원고 엑셀 업로드 (부족한 수량은 아래 가이드라인으로 AI가 자동 생성합니다)
                      </label>
                      <input
                        ref={reviewTextInputRef}
                        type="file"
                        accept=".xlsx,.csv"
                        onChange={(e) => setReviewTextFile(e.target.files[0] || null)}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => reviewTextInputRef.current?.click()}
                      >
                        <Upload size={12} />
                        엑셀 선택
                      </Button>
                    </div>
                    {reviewTextFile && (
                      <span className="mt-1 flex w-fit items-center gap-1 rounded-btn bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {reviewTextFile.name}
                        <button
                          type="button"
                          onClick={() => {
                            setReviewTextFile(null)
                            if (reviewTextInputRef.current) reviewTextInputRef.current.value = ''
                          }}
                          className="text-gray-400 hover:text-danger-text"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">
                      원고 가이드라인 (엑셀 업로드분이 부족할 때 AI가 참고하는 예시)
                    </label>
                    <textarea
                      value={reviewTargetForm.guideline}
                      onChange={(e) => setReviewTargetForm({ ...reviewTargetForm, guideline: e.target.value })}
                      rows={5}
                      className="mt-1 w-full rounded-btn border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">지역적 특징</label>
                    <textarea
                      value={reviewTargetForm.regional_features}
                      onChange={(e) => setReviewTargetForm({ ...reviewTargetForm, regional_features: e.target.value })}
                      rows={2}
                      placeholder="예: 근처 관광지, 교통 접근성 등 리뷰에 녹일 수 있는 지역 특징"
                      className="w-full rounded-btn border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">리뷰 글자수</label>
                    <div className="mt-1 flex items-center gap-1">
                      {REVIEW_LENGTH_OPTIONS.map((len) => (
                        <button
                          key={len}
                          type="button"
                          onClick={() => setReviewTargetForm({ ...reviewTargetForm, review_length: len })}
                          className={`rounded px-2 py-1 text-xs font-medium ${
                            Number(reviewTargetForm.review_length) === len
                              ? 'bg-brand-500 text-white'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {len}자
                        </button>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePreviewReviewText}
                        disabled={previewing}
                        className="ml-1"
                      >
                        {previewing ? '생성 중...' : '예시 보기'}
                      </Button>
                    </div>
                    {previewText && (
                      <p className="mt-1 whitespace-pre-wrap rounded-card border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
                        {previewText}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">
                      메뉴 3개 (매장의 대표상품에서 자동으로 채워집니다 — 이 캠페인만 다르게 쓰려면
                      직접 수정하세요. 영수증 이미지 생성에도 사용됩니다)
                    </label>
                    {selectedReviewTargetStore && !selectedReviewTargetStore.representative_product && (
                      <p className="mt-1 text-xs text-warning-text">
                        이 매장은 대표상품이 등록되어 있지 않아요.
                      </p>
                    )}
                    <div className="space-y-1">
                      {reviewTargetForm.menu_items.map((item, i) => (
                        <div key={i} className="flex gap-1">
                          <Input
                            value={item.name}
                            onChange={(e) => updateReviewTargetMenuItem(i, 'name', enforceProductNameLength(e.target.value))}
                            placeholder={`메뉴명 ${i + 1} (최대 ${MAX_PRODUCT_NAME_LENGTH}자)`}
                            className="flex-1"
                          />
                          <Input
                            type="number"
                            min="0"
                            value={item.price}
                            onChange={(e) => updateReviewTargetMenuItem(i, 'price', e.target.value)}
                            placeholder="가격"
                            className="w-28"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-xs text-gray-500">
                      <input type="checkbox" checked={usePhotos} onChange={(e) => setUsePhotos(e.target.checked)} />
                      사진을 리뷰에 사용
                    </label>
                    {usePhotos && (
                      <div className="mt-2 space-y-2 rounded-card border border-gray-200 bg-gray-50 p-2">
                        <div>
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => setPhotoFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => photoInputRef.current?.click()}
                            className="bg-white"
                          >
                            <Upload size={12} />
                            사진 업로드하기
                          </Button>
                          {photoFiles.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {photoFiles.map((f, i) => (
                                <span
                                  key={`${f.name}-${i}`}
                                  className="flex items-center gap-1 rounded-btn bg-white px-2 py-0.5 text-xs text-gray-600"
                                >
                                  {f.name}
                                  <button
                                    type="button"
                                    onClick={() => setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                    className="text-gray-400 hover:text-danger-text"
                                  >
                                    <X size={10} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="mt-1 text-xs text-gray-400">
                            업로드한 사진은 저장 전 EXIF(촬영정보)가 자동으로 랜덤 처리됩니다.
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500">리뷰당 사진 갯수</label>
                          <Input
                            type="number"
                            min="1"
                            value={reviewTargetForm.photos_per_review}
                            onChange={(e) =>
                              setReviewTargetForm((prev) => ({ ...prev, photos_per_review: e.target.value }))
                            }
                            className="w-20"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {error && <p className="text-sm text-danger-text">{error}</p>}
                <Button type="submit" variant="primary" disabled={submitting || !reviewTargetForm.store_id} className="w-full">
                  등록 (오픈풀에 공개)
                </Button>
              </form>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}

const PRIVACY_CONSENT_DETAIL = `수집 항목: 이름, 전화번호, 사업자등록증
수집 목적: 회원 식별, 광고주 승인 심사, 매장·캠페인 관리, 정산, 문의 응대
보유 및 이용 기간: 회원 탈퇴 시까지 (관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 별도 보관 후 파기)
동의를 거부할 권리가 있으며, 동의하지 않을 경우 회원가입 및 서비스 이용이 제한됩니다.`
const MARKETING_CONSENT_DETAIL = `전송자: 이지리뷰
전송 내용: 신규 기능·이벤트·공지 등 광고성 정보
전송 방법: 휴대폰 문자메시지(SMS)
동의하지 않아도 서비스 이용에는 제한이 없으며, 동의 후에도 이 화면에서 언제든지 수신 동의를 철회할 수 있습니다.`

function ConsentCheckbox({ label, checked, onChange, detail }) {
  const [showDetail, setShowDetail] = useState(false)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          className="text-xs text-gray-400 underline hover:text-gray-600"
        >
          {showDetail ? '접기' : '내용보기'}
        </button>
      </div>
      {showDetail && (
        <p className="whitespace-pre-line rounded-btn border border-gray-200 bg-gray-50 p-2 text-xs text-gray-500">
          {detail}
        </p>
      )}
    </div>
  )
}

function ProfileEditModal({ token, me, onClose, onUpdated }) {
  const [name, setName] = useState(me.name || '')
  const [contactInfo, setContactInfo] = useState(me.contact_info || '')
  const [privacyConsent, setPrivacyConsent] = useState(!!me.privacy_consent)
  const [marketingConsent, setMarketingConsent] = useState(!!me.marketing_consent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [businessRegFile, setBusinessRegFile] = useState(null)
  const [uploadingBusinessReg, setUploadingBusinessReg] = useState(false)
  const [businessRegImagePath, setBusinessRegImagePath] = useState(me.business_registration_image_path || null)

  async function handleUploadBusinessReg() {
    if (!businessRegFile) return
    setUploadingBusinessReg(true)
    setError(null)
    try {
      const updated = await portalApi.uploadBusinessRegistrationImage(token, businessRegFile)
      setBusinessRegImagePath(updated.business_registration_image_path)
      setBusinessRegFile(null)
      await onUpdated()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploadingBusinessReg(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!privacyConsent) {
      setError('개인정보 수집·이용에 동의해야 서비스를 계속 이용할 수 있어요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await portalApi.updateProfile(token, {
        name: name.trim(),
        contact_info: contactInfo.trim() || undefined,
        privacy_consent: privacyConsent,
        marketing_consent: marketingConsent,
      })
      await onUpdated()
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose}>
      <h3 className="mb-3 font-semibold text-gray-800">내 정보 수정</h3>
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500">이름</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="w-full" required />
        </div>
        <div>
          <label className="block text-xs text-gray-500">연락처</label>
          <Input
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="010-1234-5678"
            className="w-full"
          />
        </div>

        <div className="space-y-1.5 rounded-btn border border-gray-200 p-2.5">
          <label className="block text-xs text-gray-500">사업자등록증</label>
          {businessRegImagePath ? (
            <a
              href={`${API_ORIGIN}${businessRegImagePath}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-600 hover:underline"
            >
              제출된 이미지 확인
            </a>
          ) : (
            <p className="text-xs text-gray-400">아직 제출한 이미지가 없어요.</p>
          )}
          <div className="flex items-center gap-1.5">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setBusinessRegFile(e.target.files?.[0] || null)}
              className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-xs text-gray-900"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleUploadBusinessReg}
              disabled={!businessRegFile || uploadingBusinessReg}
              className="shrink-0"
            >
              {uploadingBusinessReg ? '제출 중...' : '다시 제출'}
            </Button>
          </div>
        </div>

        <ConsentCheckbox
          label="개인정보 수집·이용에 동의합니다 (필수)"
          checked={privacyConsent}
          onChange={setPrivacyConsent}
          detail={PRIVACY_CONSENT_DETAIL}
        />
        <ConsentCheckbox
          label="문자 등 마케팅 정보 수신에 동의합니다 (선택)"
          checked={marketingConsent}
          onChange={setMarketingConsent}
          detail={MARKETING_CONSENT_DETAIL}
        />

        {error && <p className="text-sm text-danger-text">{error}</p>}
        <Button type="submit" variant="primary" disabled={saving} className="w-full">
          {saving ? '저장 중...' : '저장'}
        </Button>
      </form>
    </Modal>
  )
}

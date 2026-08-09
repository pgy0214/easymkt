import { ExternalLink, LogOut, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { API_ORIGIN, portalApi } from '../lib/api.js'
import {
  AGE_GROUP_OPTIONS,
  BLOG_INDEX_OPTIONS,
  formatDateTime,
  formatKRW,
  PLATFORM_LABEL,
  REGION_OPTIONS,
  TOPIC_OPTIONS,
} from '../lib/format.js'
import AccountForm from './AccountForm.jsx'
import CopyButton from './CopyButton.jsx'
import ImageCopyButton from './ImageCopyButton.jsx'
import ImageDownloadButton from './ImageDownloadButton.jsx'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'
import WorkRulesModal from './WorkRulesModal.jsx'

const WORK_RULES_KEY = 'workRulesAcknowledged_v1'

const TOKEN_KEY = 'portal_token'
const MODE_KEY = 'portal_mode'

export default function Portal() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [checkingDevAutoLogin, setCheckingDevAutoLogin] = useState(!token)
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || 'reviewer')

  function handleModeChange(next) {
    localStorage.setItem(MODE_KEY, next)
    setMode(next)
  }

  useEffect(() => {
    if (token) return
    portalApi
      .devAutoLogin()
      .then((result) => {
        if (result.enabled && result.token) {
          localStorage.setItem(TOKEN_KEY, result.token)
          setToken(result.token)
        }
      })
      .finally(() => setCheckingDevAutoLogin(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!token && checkingDevAutoLogin) {
    return null
  }

  if (!token) {
    return (
      <LoginFlow
        onLoggedIn={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t) }}
      />
    )
  }

  return (
    <PortalHome
      token={token}
      mode={mode}
      onModeChange={handleModeChange}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      }}
    />
  )
}

const PRIVACY_CONSENT_DETAIL = `수집 항목: 이름, 전화번호, (체험단 활동 시) 성별·지역·연령대·관심 주제
수집 목적: 회원 식별, 리뷰단/체험단 작업 배정 및 진행 관리, 정산, 문의 응대
보유 및 이용 기간: 회원 탈퇴 시까지 (관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 별도 보관 후 파기)
동의를 거부할 권리가 있으며, 동의하지 않을 경우 회원가입 및 서비스 이용이 제한됩니다.`
const MARKETING_CONSENT_DETAIL = `전송자: 이지리뷰
전송 내용: 신규 캠페인·이벤트·공지 등 광고성 정보
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

function LoginFlow({ onLoggedIn }) {
  const [step, setStep] = useState('login') // 'login' | 'phone' | 'code' | 'complete-signup' | 'temp-password'
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pendingToken, setPendingToken] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [kakaoConfig, setKakaoConfig] = useState(null)
  const [kakaoAccessToken, setKakaoAccessToken] = useState(null) // set once linked=false로 확인 단계에 들어가면
  const [checkingKakaoRedirect, setCheckingKakaoRedirect] = useState(false)

  // 회원가입 완료 단계 입력값
  const [signupUsername, setSignupUsername] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupConsent, setSignupConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [showExperienceFields, setShowExperienceFields] = useState(false)
  const [gender, setGender] = useState('')
  const [region, setRegion] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [topics, setTopics] = useState([])

  // 임시 비밀번호 발급 결과
  const [tempPasswordResult, setTempPasswordResult] = useState(null)

  useEffect(() => {
    portalApi.kakaoConfig().then(setKakaoConfig).catch(() => setKakaoConfig({ configured: false }))

    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return
    setCheckingKakaoRedirect(true)
    window.history.replaceState({}, '', window.location.pathname)
    portalApi
      .kakaoExchange(code)
      .then((result) => {
        if (result.linked) {
          onLoggedIn(result.token)
          return
        }
        setKakaoAccessToken(result.kakao_access_token)
        if (result.suggested_name) setSignupName(result.suggested_name)
        setStep('phone')
      })
      .catch((err) => setError(err.message))
      .finally(() => setCheckingKakaoRedirect(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleKakaoLogin() {
    if (!kakaoConfig?.configured) return
    const url = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoConfig.client_id}&redirect_uri=${encodeURIComponent(kakaoConfig.redirect_uri)}&response_type=code`
    window.location.href = url
  }

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
      if (kakaoAccessToken) {
        const result = await portalApi.kakaoConfirm({
          phone: phone.trim(),
          code: code.trim(),
          kakao_access_token: kakaoAccessToken,
          name: signupName.trim() || undefined,
        })
        if (result.needs_signup) {
          setPendingToken(result.token)
          setStep('complete-signup')
        } else {
          onLoggedIn(result.token)
        }
        return
      }
      const result = await portalApi.verifyOtp(phone.trim(), code.trim())
      if (result.needs_signup) {
        setPendingToken(result.token)
        setSignupName((result.reviewer.name && result.reviewer.name !== phone.trim()) ? result.reviewer.name : '')
        setError(null)
        setStep('complete-signup')
      } else {
        // 이미 가입된 계정 — 비밀번호를 잊어서 온 경우: 임시 비밀번호를 바로 발급
        const reset = await portalApi.resetPassword(result.token)
        setTempPasswordResult(reset)
        setError(null)
        setStep('temp-password')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function toggleTopic(topic) {
    setTopics((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]))
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
        marketing_consent: marketingConsent,
        gender: gender || undefined,
        region: region || undefined,
        age_group: ageGroup || undefined,
        topics: topics.length > 0 ? topics : undefined,
      })
      onLoggedIn(result.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function backToLogin(prefillUsername) {
    setStep('login')
    setError(null)
    setMessage(null)
    setPassword('')
    if (prefillUsername) setUsername(prefillUsername)
  }

  if (checkingKakaoRedirect) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-card border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        카카오 로그인 확인 중...
      </div>
    )
  }

  const TITLE_BY_STEP = {
    login: '로그인',
    phone: '본인확인',
    code: '본인확인',
    'complete-signup': '회원가입',
    'temp-password': '임시 비밀번호 발급',
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-card border border-gray-200 bg-white p-6">
      <img src="/logo.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
      <h1 className="mb-4 text-center text-lg font-semibold text-gray-900">
        이지리뷰 <span className="font-normal text-gray-400">{TITLE_BY_STEP[step]}</span>
      </h1>

      {kakaoAccessToken && (
        <p className="mb-3 text-sm text-brand-700">
          카카오 로그인 확인됨 — 이 계정에 연결할 전화번호로 인증번호를 받아주세요.
        </p>
      )}

      {step === 'login' && (
        <form onSubmit={handleLogin} className="space-y-3">
          <Input
            label="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
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
            처음이신가요? 비밀번호를 잊으셨나요? 전화번호로 확인
          </button>
        </form>
      )}

      {step === 'phone' && (
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <button
            type="button"
            onClick={() => backToLogin()}
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
          <Input
            label="인증번호 (6자리)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
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
          <Input label="이름" value={signupName} onChange={(e) => setSignupName(e.target.value)} />

          <button
            type="button"
            onClick={() => setShowExperienceFields((v) => !v)}
            className="w-full rounded-btn border border-gray-200 px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50"
          >
            {showExperienceFields ? '▾' : '▸'} 체험단 활동을 하신다면 추가로 입력해주세요 (선택)
          </button>

          {showExperienceFields && (
            <div className="space-y-2 rounded-btn border border-gray-200 p-2.5">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500">성별</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  >
                    <option value="">선택 안 함</option>
                    <option value="male">남성</option>
                    <option value="female">여성</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500">연령대</label>
                  <select
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value)}
                    className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  >
                    <option value="">선택 안 함</option>
                    {AGE_GROUP_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">지역</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                >
                  <option value="">선택 안 함</option>
                  {REGION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500">주제 (복수 선택 가능)</label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {TOPIC_OPTIONS.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      className={`rounded-btn border px-2 py-0.5 text-xs font-medium ${
                        topics.includes(topic)
                          ? 'border-brand-400 bg-brand-50 text-brand-700'
                          : 'border-gray-300 text-gray-600'
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-btn border border-gray-200 bg-gray-50 p-2.5 text-xs text-gray-500">
            <p className="mb-1 font-medium text-gray-600">개인정보 수집·이용 동의</p>
            <p>
              수집 항목: 이름, 전화번호 · 이용 목적: 리뷰단/체험단 작업 배정 및 연락 ·
              보유 기간: 회원 탈퇴 시까지
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={signupConsent}
              onChange={(e) => setSignupConsent(e.target.checked)}
            />
            위 개인정보 수집·이용에 동의합니다 (필수)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
            />
            문자 등 마케팅 정보 수신에 동의합니다 (선택)
          </label>

          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            가입 완료
          </Button>
          {error && <p className="text-sm text-danger-text">{error}</p>}
        </form>
      )}

      {step === 'temp-password' && tempPasswordResult && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            임시 비밀번호가 발급되었습니다. 아래 정보로 로그인한 뒤 비밀번호를 기억해두세요.
          </p>
          <div className="space-y-1 rounded-btn border border-gray-200 bg-gray-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">아이디</span>
              <span className="font-medium text-gray-800">{tempPasswordResult.username}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">임시 비밀번호</span>
              <span className="flex items-center gap-1 font-medium text-gray-800">
                {tempPasswordResult.temp_password}
                <CopyButton value={tempPasswordResult.temp_password} label="임시 비밀번호" />
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={() => backToLogin(tempPasswordResult.username)}
          >
            로그인 화면으로
          </Button>
        </div>
      )}

      {!kakaoAccessToken && kakaoConfig?.configured && (step === 'login' || step === 'phone') && (
        <div className="mt-4 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleKakaoLogin}
            className="w-full rounded-btn bg-[#FEE500] px-4 py-1.5 text-sm font-medium text-[#191600] hover:brightness-95"
          >
            카카오로 로그인
          </button>
        </div>
      )}
    </div>
  )
}

function PortalHome({ token, mode, onModeChange, onLogout }) {
  const [reviewer, setReviewer] = useState(null)
  const [pool, setPool] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availability, setAvailability] = useState(null)
  const [rulesAcknowledged, setRulesAcknowledged] = useState(
    () => localStorage.getItem(WORK_RULES_KEY) === 'true',
  )
  const [showRules, setShowRules] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)

  function handleAcknowledgeRules() {
    localStorage.setItem(WORK_RULES_KEY, 'true')
    setRulesAcknowledged(true)
    setShowRules(false)
  }

  async function refresh() {
    setLoading(true)
    try {
      const [me, poolTasks, mine] = await Promise.all([
        portalApi.me(token),
        portalApi.getPool(token),
        portalApi.getMyTasks(token),
      ])
      setReviewer(me)
      setPool(poolTasks)
      setMyTasks(mine)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAddAccount(data) {
    await portalApi.addAccount(token, data)
    await refresh()
  }

  async function handleDeleteAccount(id) {
    if (!confirm('이 계정을 삭제할까요?')) return
    try {
      await portalApi.deleteAccount(token, id)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleClaim(taskId, accountId) {
    try {
      await portalApi.claimTask(token, taskId, accountId)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleCheckAvailability() {
    setCheckingAvailability(true)
    setAvailability(null)
    try {
      setAvailability(await portalApi.checkAvailability(token))
    } catch (err) {
      alert(err.message)
    } finally {
      setCheckingAvailability(false)
    }
  }

  async function handleSubmitResult(taskId, link) {
    try {
      await portalApi.submitResult(token, taskId, link)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p className="p-6 text-sm text-gray-400">불러오는 중...</p>
  if (error) return <p className="p-6 text-sm text-danger-text">{error}</p>
  if (!reviewer) return null

  return (
    <div className={`mx-auto space-y-6 p-4 ${mode === 'experience' ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-8 w-8 shrink-0" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{reviewer.name}님, 안녕하세요</h1>
            <p className="text-sm text-gray-500">{reviewer.contact_info}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-btn bg-gray-100 p-0.5">
            <button
              type="button"
              onClick={() => onModeChange('reviewer')}
              className={`rounded-btn px-2 py-1 text-xs font-medium transition-colors ${
                mode === 'reviewer' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              리뷰단
            </button>
            <button
              type="button"
              onClick={() => onModeChange('experience')}
              className={`rounded-btn px-2 py-1 text-xs font-medium transition-colors ${
                mode === 'experience' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              체험단
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowProfileEdit(true)}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            내 정보 수정
          </button>
          <button onClick={onLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      </div>

      {showProfileEdit && (
        <ProfileEditModal
          token={token}
          reviewer={reviewer}
          onClose={() => setShowProfileEdit(false)}
          onUpdated={refresh}
        />
      )}

      {!reviewer.is_active && (
        <div className="rounded-card border border-amber-200 bg-warning-bg px-3 py-2 text-sm text-warning-text">
          관리자 승인 대기 중입니다. 계정 정보는 미리 등록해두실 수 있지만, 승인 후에 작업을
          가져갈 수 있어요.
        </div>
      )}

      {mode === 'experience' ? (
        <>
          <ExperienceProfileCard token={token} reviewer={reviewer} onUpdated={refresh} />
          <ExperienceCampaignList token={token} />
        </>
      ) : (
        <>
          <Card padding="md" className="space-y-2">
            <h2 className="font-medium text-gray-800">내 계정</h2>
            {reviewer.accounts.length === 0 && (
              <p className="text-sm text-gray-400">등록된 계정이 없습니다. 아래에서 추가해주세요.</p>
            )}
            {reviewer.accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-btn border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    {PLATFORM_LABEL[account.platform]}
                  </span>
                  <span className="font-medium text-gray-700">{account.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {account.profile_url && (
                    <a
                      href={account.profile_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 text-xs text-brand-600 hover:underline"
                    >
                      마이플레이스
                      <ExternalLink size={11} />
                    </a>
                  )}
                  <button onClick={() => handleDeleteAccount(account.id)} className="text-gray-400 hover:text-danger-text">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            <AccountForm onCreate={handleAddAccount} />
          </Card>

          <Card padding="md" className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-800">가능한 작업</h2>
              <button
                type="button"
                onClick={handleCheckAvailability}
                disabled={checkingAvailability}
                className="rounded-btn border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {checkingAvailability ? '확인 중...' : '가능한 계정 확인하기'}
              </button>
            </div>
            {checkingAvailability && (
              <p className="text-xs text-gray-400">
                내 계정 마이플레이스를 직접 확인하고 있어요. 계정당 몇 초씩 걸릴 수 있어요...
              </p>
            )}
            {availability && (
              <div className="space-y-1 rounded-btn border border-gray-100 bg-gray-50 p-2 text-xs">
                {availability.length === 0 && (
                  <p className="text-gray-400">마이플레이스 URL이 등록된 네이버 계정이 없습니다.</p>
                )}
                {availability.map((a) => (
                  <p key={a.account_id} className="text-gray-600">
                    {a.label}:{' '}
                    {a.error ? (
                      <span className="text-danger-text">확인 실패 ({a.error})</span>
                    ) : a.available_date ? (
                      <span className="text-success-text">{a.available_date} 작성 가능</span>
                    ) : (
                      <span className="text-warning-text">최근 7일 모두 사용해서 작성 가능한 날짜 없음</span>
                    )}
                  </p>
                ))}
              </div>
            )}
            {pool.length === 0 && <p className="text-sm text-gray-400">지금 가져갈 수 있는 작업이 없습니다.</p>}
            {pool.map((group) => (
              <PoolTaskRow
                key={group.review_target_id}
                group={group}
                myAccounts={reviewer.accounts.filter((a) => a.platform === group.platform)}
                onClaim={handleClaim}
                disabled={checkingAvailability}
              />
            ))}
          </Card>

          <Card padding="md" className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-gray-800">내 작업</h2>
              <button
                type="button"
                onClick={() => setShowRules(true)}
                className={`rounded-btn border px-2 py-1 text-xs font-medium ${
                  rulesAcknowledged
                    ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    : 'border-amber-400 bg-warning-bg text-warning-text hover:bg-amber-100'
                }`}
              >
                {rulesAcknowledged ? '작업수칙 다시보기' : '작업수칙확인하기'}
              </button>
            </div>
            {!rulesAcknowledged && (
              <p className="text-xs text-warning-text">먼저 작업수칙을 확인해야 작업을 진행할 수 있어요.</p>
            )}
            {myTasks.length === 0 && <p className="text-sm text-gray-400">진행 중인 작업이 없습니다.</p>}
            {myTasks.map((task) => (
              <MyTaskRow
                key={task.id}
                task={task}
                token={token}
                onSubmitResult={handleSubmitResult}
                locked={!rulesAcknowledged}
              />
            ))}
          </Card>

          {showRules && (
            <WorkRulesModal onClose={() => setShowRules(false)} onAcknowledge={handleAcknowledgeRules} />
          )}
        </>
      )}
    </div>
  )
}

function ProfileEditModal({ token, reviewer, onClose, onUpdated }) {
  const [name, setName] = useState(reviewer.name || '')
  const [contactInfo, setContactInfo] = useState(reviewer.contact_info || '')
  const [gender, setGender] = useState(reviewer.gender || '')
  const [region, setRegion] = useState(reviewer.region || '')
  const [ageGroup, setAgeGroup] = useState(reviewer.age_group || '')
  const [topics, setTopics] = useState(reviewer.topics ? reviewer.topics.split(',') : [])
  const [privacyConsent, setPrivacyConsent] = useState(!!reviewer.privacy_consent)
  const [marketingConsent, setMarketingConsent] = useState(!!reviewer.marketing_consent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function toggleTopic(topic) {
    setTopics((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]))
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
        gender: gender || null,
        region: region || null,
        age_group: ageGroup || null,
        topics,
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
    <Modal open onClose={onClose} size="md">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-800">내 정보 수정</h3>
        <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-700">
          닫기
        </button>
      </div>
      <form onSubmit={handleSave} className="mt-3 space-y-3">
        <Input label="이름" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="연락처"
          value={contactInfo}
          onChange={(e) => setContactInfo(e.target.value)}
          placeholder="010-1234-5678"
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500">성별</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">선택 안 함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500">연령대</label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">선택 안 함</option>
              {AGE_GROUP_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500">지역</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          >
            <option value="">선택 안 함</option>
            {REGION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">주제 (복수 선택 가능)</label>
          <div className="mt-1 flex flex-wrap gap-1">
            {TOPIC_OPTIONS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => toggleTopic(topic)}
                className={`rounded-btn border px-2 py-0.5 text-xs font-medium ${
                  topics.includes(topic)
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-gray-300 text-gray-600'
                }`}
              >
                {topic}
              </button>
            ))}
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
          저장
        </Button>
      </form>
    </Modal>
  )
}

const CAMPAIGN_DDAY_MS = 24 * 60 * 60 * 1000

// recruit_start/recruit_end는 타임존 표기 없는 UTC 문자열이라 'Z'를 붙여야 로컬시각과
// 올바르게 비교/표시된다(CampaignManager.jsx의 동일한 변환 로직과 짝)
function campaignDaysLeft(recruitEnd) {
  const recruitEndUtc = recruitEnd.includes('Z') ? recruitEnd : `${recruitEnd}Z`
  return Math.ceil((new Date(recruitEndUtc) - new Date()) / CAMPAIGN_DDAY_MS)
}

function formatCampaignDate(value) {
  if (!value) return '-'
  const date = new Date(value.includes('Z') ? value : `${value}Z`)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function ExperienceProfileCard({ token, reviewer, onUpdated }) {
  const [blogUrl, setBlogUrl] = useState(reviewer.blog_url || '')
  const [blogIndex, setBlogIndex] = useState(reviewer.blog_index || '')
  const [email, setEmail] = useState(reviewer.email || '')
  const [duplicate, setDuplicate] = useState(!!reviewer.blog_duplicate)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      const result = await portalApi.updateMyBlogUrl(
        token,
        blogUrl.trim(),
        blogIndex,
        email.trim() || undefined,
      )
      await onUpdated()
      setSaved(true)
      setDuplicate(!!result.blog_duplicate)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card padding="md" className="space-y-2">
      <h2 className="font-medium text-gray-800">내 계정</h2>
      <form onSubmit={handleSave} className="space-y-2">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-xs text-gray-500">블로그 주소</label>
            <div className="flex items-center gap-1">
              <Input
                value={blogUrl}
                onChange={(e) => setBlogUrl(e.target.value)}
                placeholder="https://blog.naver.com/..."
                className="w-full"
              />
              <CopyButton value={blogUrl} label="블로그 주소" />
            </div>
          </div>
          <div className="w-28 shrink-0">
            <label className="block text-xs text-gray-500">지수</label>
            <select
              value={blogIndex}
              onChange={(e) => setBlogIndex(e.target.value)}
              className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">선택 안 함</option>
              {BLOG_INDEX_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-btn border border-gray-200 bg-gray-50 px-2.5 py-1.5">
          <p className="text-xs text-gray-500">블덱스에서 지수를 확인 후 선택해주세요.</p>
          <a
            href="https://blogdex.space/lookup"
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-btn border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            블덱스 바로가기
            <ExternalLink size={12} />
          </a>
        </div>
        {duplicate && (
          <div className="rounded-btn border border-amber-200 bg-warning-bg p-2.5 text-xs text-warning-text">
            <p className="mb-1 font-medium">이미 등록된 블로그 주소와 같아요.</p>
            <p className="mb-2">
              본인이 맞으시면 관리자에게 문의해주세요. 확인을 위해 이메일을 남겨주시면
              같이 전달할게요.
            </p>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full"
            />
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            저장
          </Button>
        </div>
      </form>
      {saved && <p className="text-xs text-success-text">저장했어요.</p>}
      {reviewer.blog_url && (
        <div className="flex items-center justify-between rounded-btn border border-gray-100 bg-gray-50 px-3 py-1.5 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-gray-700">{reviewer.blog_url}</span>
            {reviewer.blog_index && (
              <span className="shrink-0 rounded-btn bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                {reviewer.blog_index}
              </span>
            )}
          </div>
          <a
            href={reviewer.blog_url}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs text-brand-600 hover:underline"
          >
            바로가기
            <ExternalLink size={11} />
          </a>
        </div>
      )}
    </Card>
  )
}

function ExperienceCampaignList({ token }) {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [applyingId, setApplyingId] = useState(null)
  const [detailCampaign, setDetailCampaign] = useState(null)

  async function refresh() {
    setLoading(true)
    try {
      setCampaigns(await portalApi.getExperienceCampaigns(token))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleApply(campaignId) {
    setApplyingId(campaignId)
    try {
      const updated = await portalApi.applyToExperienceCampaign(token, campaignId)
      setCampaigns((prev) => prev.map((c) => (c.id === campaignId ? updated : c)))
      setDetailCampaign((prev) => (prev && prev.id === campaignId ? updated : prev))
    } catch (err) {
      alert(err.message)
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <Card padding="md" className="space-y-2">
      <h2 className="font-medium text-gray-800">체험단 캠페인</h2>
      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {error && <p className="text-sm text-danger-text">{error}</p>}
      {!loading && campaigns.length === 0 && (
        <p className="text-sm text-gray-400">지금 신청할 수 있는 캠페인이 없습니다.</p>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {campaigns.map((c) => {
          const daysLeft = campaignDaysLeft(c.recruit_end)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setDetailCampaign(c)}
              className="overflow-hidden rounded-card border border-gray-200 bg-white text-left hover:border-brand-300"
            >
              <div className="relative aspect-square w-full bg-gray-100">
                {c.image_path ? (
                  <img
                    src={`${API_ORIGIN}${c.image_path}`}
                    alt={c.store_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-300">
                    이미지 없음
                  </div>
                )}
                <span
                  className={`absolute right-1 top-1 rounded-btn px-1.5 py-0.5 text-[10px] font-medium shadow-sm ${
                    daysLeft <= 1 ? 'bg-danger-bg text-danger-text' : 'bg-white/90 text-gray-500'
                  }`}
                >
                  {daysLeft <= 0 ? '마감임박' : `${daysLeft}일`}
                </span>
                {c.already_applied && (
                  <span className="absolute left-1 top-1 rounded-btn bg-brand-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm">
                    신청완료
                  </span>
                )}
              </div>
              <div className="p-1.5">
                <div className="truncate text-xs font-medium text-gray-800">{c.store_name}</div>
                <div className="truncate text-[11px] text-gray-400">
                  {c.content_type} · {c.store_region || c.product_name}
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {detailCampaign && (
        <ExperienceCampaignDetailModal
          campaign={detailCampaign}
          applying={applyingId === detailCampaign.id}
          onApply={() => handleApply(detailCampaign.id)}
          onClose={() => setDetailCampaign(null)}
        />
      )}
    </Card>
  )
}

function ExperienceCampaignDetailModal({ campaign: c, applying, onApply, onClose }) {
  const daysLeft = campaignDaysLeft(c.recruit_end)
  const isFull = c.applicant_count >= c.capacity

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-btn bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {c.campaign_type}
            </span>
            <span className="rounded-btn bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {c.content_type}
            </span>
            <span className={`text-xs font-medium ${daysLeft <= 1 ? 'text-danger-text' : 'text-gray-400'}`}>
              {daysLeft <= 0 ? '마감임박' : `${daysLeft}일 남음`}
            </span>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">{c.store_name}</h3>
          {c.store_region && <p className="text-xs text-gray-500">{c.store_region}</p>}
        </div>
        <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-700">
          <X size={18} />
        </button>
      </div>

      {c.image_path && (
        <img
          src={`${API_ORIGIN}${c.image_path}`}
          alt=""
          className="mt-3 max-h-64 w-full rounded-card object-cover"
        />
      )}

      <div className="mt-3 space-y-3 text-sm">
        <div className="rounded-btn border border-gray-100 bg-gray-50 p-2.5">
          <p className="text-xs font-medium text-gray-500">캠페인 상품</p>
          <p className="text-gray-800">
            {c.product_name}
            {c.product_price ? ` · ${formatKRW(c.product_price)}` : ''}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
          <div>
            <span className="text-gray-400">모집 기간</span>
            <br />
            {formatCampaignDate(c.recruit_start)} ~ {formatCampaignDate(c.recruit_end)}
          </div>
          <div>
            <span className="text-gray-400">제출마감일</span>
            <br />
            {c.review_deadline || '-'}
          </div>
          <div>
            <span className="text-gray-400">모집 인원</span>
            <br />
            신청 {c.applicant_count}명 / {c.capacity}명
          </div>
        </div>

        {(c.main_keyword || c.sub_keyword) && (
          <div>
            <p className="text-xs font-medium text-gray-500">키워드</p>
            <p className="text-gray-700">{[c.main_keyword, c.sub_keyword].filter(Boolean).join(' / ')}</p>
          </div>
        )}

        {c.content_guide && (
          <div>
            <p className="text-xs font-medium text-gray-500">가이드라인</p>
            <p className="whitespace-pre-wrap text-gray-700">{c.content_guide}</p>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-gray-500">방문 정보</p>
          <p className="text-gray-700">
            {c.reservation_required ? '예약 필요' : '예약 없이 방문 가능'}
            {c.contact_name && ` · 담당자 ${c.contact_name}`}
            {c.contact_method && c.contact_info && ` · ${c.contact_method} ${c.contact_info}`}
          </p>
          {c.extra_info && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{c.extra_info}</p>}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        {c.store_url && (
          <a
            href={c.store_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-btn border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            구경하기
            <ExternalLink size={14} />
          </a>
        )}
        <Button
          variant={c.already_applied ? 'outline' : 'primary'}
          disabled={c.already_applied || (isFull && !c.already_applied) || applying}
          onClick={onApply}
        >
          {c.already_applied ? '신청완료' : isFull ? '마감' : applying ? '신청 중...' : '신청하기'}
        </Button>
      </div>
    </Modal>
  )
}

function PoolTaskRow({ group, myAccounts, onClaim, disabled }) {
  const eligibleIds = new Set(group.eligible_account_ids ?? myAccounts.map((a) => a.id))
  const eligibleAccounts = myAccounts.filter((a) => eligibleIds.has(a.id))
  const [accountId, setAccountId] = useState(eligibleAccounts[0]?.id ?? '')

  return (
    <div className="flex items-center justify-between rounded-btn border border-gray-100 px-3 py-2 text-sm">
      <div>
        <div className="font-medium text-gray-700">{group.store_name}</div>
        <div className="text-xs text-gray-500">
          {PLATFORM_LABEL[group.platform]} · 건당 {formatKRW(group.unit_price)} · 오늘{' '}
          {group.remaining_today}/{group.total_today} 남음
        </div>
        {eligibleAccounts.length === 0 && (
          <div className="text-xs text-warning-text">
            보유 계정이 모두 이 매장의 재작업 가능 기간이 지나지 않았어요
          </div>
        )}
      </div>
      {eligibleAccounts.length > 0 && (
        <div className="flex items-center gap-2">
          {eligibleAccounts.length > 1 && (
            <select
              value={accountId}
              onChange={(e) => setAccountId(Number(e.target.value))}
              className="rounded-btn border border-gray-300 px-1.5 py-1 text-xs"
            >
              {eligibleAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => onClaim(group.sample_task_id, accountId)}
            disabled={!accountId || disabled}
          >
            작업신청
          </Button>
        </div>
      )}
    </div>
  )
}

function MyTaskRow({ task, token, onSubmitResult, locked }) {
  const [link, setLink] = useState('')
  const [showBrief, setShowBrief] = useState(false)
  const canSubmit = task.status === 'ready' || (task.platform === 'kakao' && task.status === 'claimed')

  return (
    <div className="rounded-btn border border-gray-100 px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-medium text-gray-700">{task.store_name}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{PLATFORM_LABEL[task.platform]}</span>
          <button
            type="button"
            onClick={() => setShowBrief(true)}
            disabled={locked}
            title={locked ? '먼저 작업수칙을 확인해주세요' : undefined}
            className="rounded-btn border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            리뷰 자료 보기
          </button>
        </div>
      </div>
      {(task.account_label || task.account_profile_url) && (
        <div className="mt-0.5 text-xs text-gray-500">
          작업 계정: {task.account_label || '-'}
          {task.account_profile_url && (
            <>
              {' · '}
              <a
                href={task.account_profile_url}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline"
              >
                플레이스 주소 열기
              </a>
            </>
          )}
        </div>
      )}
      {task.claim_deadline && task.status !== 'completed' && (
        <div className="text-xs text-gray-500">기한: {formatDateTime(task.claim_deadline)}</div>
      )}
      {showBrief && <TaskBriefModal token={token} taskId={task.id} onClose={() => setShowBrief(false)} />}
      {task.status === 'completed' ? (
        <a href={task.result_link} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
          제출한 결과 보기
        </a>
      ) : canSubmit ? (
        <div className="mt-1 flex gap-1">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="결과 링크"
            disabled={locked}
            className="w-40 rounded-btn border border-gray-300 px-1.5 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          />
          <Button
            size="sm"
            variant="secondary"
            className="px-2 py-0.5 disabled:cursor-not-allowed"
            onClick={() => link.trim() && onSubmitResult(task.id, link.trim())}
            disabled={locked}
            title={locked ? '먼저 작업수칙을 확인해주세요' : undefined}
          >
            제출
          </Button>
        </div>
      ) : (
        <div className="mt-1 text-xs text-gray-400">
          {task.platform === 'naver' ? '날짜 확인 중이에요, 잠시만 기다려주세요' : '진행 중'}
        </div>
      )}
    </div>
  )
}

function TaskBriefModal({ token, taskId, onClose }) {
  const [brief, setBrief] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    portalApi
      .getTaskBrief(token, taskId)
      .then(setBrief)
      .catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const hasNothing =
    brief &&
    !brief.reference_photo_path &&
    !brief.assigned_photo_paths?.length &&
    !brief.assigned_review_text &&
    !brief.receipt_image_path

  return (
    <Modal open onClose={onClose} size="md">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-800">리뷰 자료</h3>
        <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-700">
          닫기
        </button>
      </div>

      {error && <p className="text-sm text-danger-text">{error}</p>}
      {!brief && !error && <p className="text-sm text-gray-400">불러오는 중...</p>}

      {brief && (
        <div className="space-y-3 text-sm">
          {hasNothing && (
            <p className="text-gray-400">아직 등록된 원고 자료가 없습니다.</p>
          )}

          {brief.assigned_review_text && (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-gray-800">원고</p>
                <CopyButton value={brief.assigned_review_text} label="원고" size="lg" />
              </div>
              <p className="mt-1 whitespace-pre-wrap text-gray-700">{brief.assigned_review_text}</p>
            </div>
          )}

          {brief.reference_photo_path && (
            <div>
              <p className="text-xs font-medium text-gray-500">참고 이미지</p>
              <img
                src={`${API_ORIGIN}${brief.reference_photo_path}`}
                alt="참고 이미지"
                className="mt-1 max-h-64 rounded border border-gray-200"
              />
            </div>
          )}

          {brief.assigned_photo_paths?.length > 0 && (
            <div>
              <p className="text-base font-bold text-gray-800">
                첨부사진 ({brief.assigned_photo_paths.length}장)
              </p>
              <div className="mt-2 space-y-3">
                {brief.assigned_photo_paths.map((path, i) => (
                  <div key={path} className="space-y-2">
                    <img
                      src={`${API_ORIGIN}${path}`}
                      alt="배정된 사진"
                      className="w-full rounded border border-gray-200"
                    />
                    <div className="flex flex-wrap gap-2">
                      <ImageCopyButton src={`${API_ORIGIN}${path}`} label="사진" size="lg" />
                      <ImageDownloadButton
                        src={`${API_ORIGIN}${path}`}
                        filename={`사진_${i + 1}.jpg`}
                        label="사진"
                        size="lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {brief.receipt_image_path ? (
            <div>
              <p className="text-base font-bold text-gray-800">영수증이미지</p>
              <img
                src={`${API_ORIGIN}${brief.receipt_image_path}`}
                alt="영수증 이미지"
                className="mt-1 w-full max-h-96 rounded border border-gray-200"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <ImageCopyButton src={`${API_ORIGIN}${brief.receipt_image_path}`} label="영수증" size="lg" />
                <ImageDownloadButton
                  src={`${API_ORIGIN}${brief.receipt_image_path}`}
                  filename="영수증.jpg"
                  label="영수증"
                  size="lg"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              영수증 이미지는 네이버 날짜 확인이 끝나면 자동으로 생성됩니다.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

import { ExternalLink, LogOut, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { API_ORIGIN, portalApi } from '../lib/api.js'
import { formatDateTime, formatKRW, PLATFORM_LABEL } from '../lib/format.js'
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

function LoginFlow({ onLoggedIn }) {
  const [step, setStep] = useState('login') // 'login' | 'phone' | 'code' | 'set-password'
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [needName, setNeedName] = useState(false)
  const [consent, setConsent] = useState(false)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [pendingToken, setPendingToken] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [kakaoConfig, setKakaoConfig] = useState(null)
  const [kakaoAccessToken, setKakaoAccessToken] = useState(null) // set once linked=false로 확인 단계에 들어가면
  const [checkingKakaoRedirect, setCheckingKakaoRedirect] = useState(false)

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
        if (result.suggested_name) setName(result.suggested_name)
        setNeedName(true)
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
      const result = await portalApi.login(phone.trim(), password)
      onLoggedIn(result.token)
    } catch (err) {
      if (err.message.includes('등록된 번호가 아닙니다')) {
        setStep('phone')
        setError('등록되지 않은 번호예요. 인증번호로 회원가입을 진행해주세요.')
      } else if (err.message.includes('비밀번호가 아직 설정되지 않았습니다')) {
        setStep('phone')
        setError('비밀번호가 아직 없어요. 인증번호로 로그인한 후 설정해주세요.')
      } else {
        setError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestOtp(e) {
    e.preventDefault()
    if (needName && !consent) {
      setError('개인정보 수집·이용에 동의해야 가입할 수 있어요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await portalApi.requestOtp(phone.trim(), needName ? name.trim() : undefined, needName ? consent : undefined)
      setMessage('인증번호를 보냈습니다. 문자로 받은 6자리 번호를 입력해주세요.')
      setStep('code')
    } catch (err) {
      if (err.message.includes('등록된 번호가 아닙니다')) {
        setNeedName(true)
        setError('처음 오셨네요! 회원가입을 진행해주세요.')
      } else {
        setError(err.message)
      }
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
          name: name.trim() || undefined,
        })
        onLoggedIn(result.token)
        return
      }
      const result = await portalApi.verifyOtp(phone.trim(), code.trim())
      setPendingToken(result.token)
      setError(null)
      setStep('set-password')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    if (newPassword.length < 4) {
      setError('비밀번호는 4자 이상이어야 해요.')
      return
    }
    if (newPassword !== newPasswordConfirm) {
      setError('비밀번호가 서로 달라요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await portalApi.setMyPassword(pendingToken, newPassword)
      onLoggedIn(pendingToken)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (checkingKakaoRedirect) {
    return (
      <div className="mx-auto mt-16 max-w-sm rounded-card border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        카카오 로그인 확인 중...
      </div>
    )
  }

  const title =
    step === 'login' ? '로그인' : step === 'set-password' ? '비밀번호 설정' : needName ? '회원가입' : '로그인'

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-card border border-gray-200 bg-white p-6">
      <img src="/logo.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
      <h1 className="mb-4 text-center text-lg font-semibold text-gray-900">
        이지리뷰 <span className="font-normal text-gray-400">{title}</span>
      </h1>

      {kakaoAccessToken && (
        <p className="mb-3 text-sm text-brand-700">
          카카오 로그인 확인됨 — 이 계정에 연결할 전화번호로 인증번호를 받아주세요.
        </p>
      )}

      {step === 'login' && (
        <form onSubmit={handleLogin} className="space-y-3">
          <Input
            label="전화번호"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
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
            처음이신가요? 비밀번호를 잊으셨나요? 인증번호로 로그인
          </button>
        </form>
      )}

      {step === 'phone' && (
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setStep('login')
              setError(null)
              setMessage(null)
              setNeedName(false)
            }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← 비밀번호로 로그인
          </button>
          <Input
            label="전화번호"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-1234-5678"
          />
          {needName && (
            <>
              <Input label="이름" value={name} onChange={(e) => setName(e.target.value)} />
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
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                위 개인정보 수집·이용에 동의합니다 (필수)
              </label>
            </>
          )}
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            {needName ? '회원가입하고 인증번호 받기' : '인증번호 받기'}
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

      {step === 'set-password' && (
        <form onSubmit={handleSetPassword} className="space-y-3">
          <p className="text-sm text-gray-500">
            앞으로 전화번호와 이 비밀번호로 로그인할 수 있어요.
          </p>
          <Input
            label="새 비밀번호"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="새 비밀번호 확인"
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            완료
          </Button>
          {error && <p className="text-sm text-danger-text">{error}</p>}
        </form>
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
    <div className="mx-auto max-w-3xl space-y-6 p-4">
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
          <button onClick={onLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      </div>

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

const CAMPAIGN_DDAY_MS = 24 * 60 * 60 * 1000

const BLOG_INDEX_OPTIONS = [
  '전체',
  '준최1', '준최2', '준최3', '준최4', '준최5', '준최6', '준최7',
  '최적1', '최적2', '최적3',
  '최적1+', '최적2+', '최적3+', '최적4+',
  '공식블로그', '인플루언서',
]

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
    </Card>
  )
}

function ExperienceCampaignList({ token }) {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [applyingId, setApplyingId] = useState(null)

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {campaigns.map((c) => {
          const daysLeft = Math.ceil((new Date(c.recruit_end) - new Date()) / CAMPAIGN_DDAY_MS)
          const isFull = c.applicant_count >= c.capacity
          return (
            <div key={c.id} className="rounded-card border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <span className="rounded-btn bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {c.campaign_type}
                </span>
                <span
                  className={`text-xs font-medium ${daysLeft <= 1 ? 'text-danger-text' : 'text-gray-400'}`}
                >
                  {daysLeft <= 0 ? '마감임박' : `${daysLeft}일 남음`}
                </span>
              </div>
              <div className="mt-1 font-medium text-gray-800">{c.store_name}</div>
              {c.store_region && <div className="text-xs text-gray-500">{c.store_region}</div>}
              <div className="mt-1 text-xs text-gray-500">
                {c.content_type} · {c.product_name}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  신청 {c.applicant_count}명 / {c.capacity}명
                </span>
                <Button
                  size="sm"
                  variant={c.already_applied ? 'outline' : 'primary'}
                  disabled={c.already_applied || (isFull && !c.already_applied) || applyingId === c.id}
                  onClick={() => handleApply(c.id)}
                >
                  {c.already_applied ? '신청완료' : isFull ? '마감' : applyingId === c.id ? '신청 중...' : '신청하기'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
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

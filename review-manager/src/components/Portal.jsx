import { LogOut, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { portalApi } from '../lib/api.js'
import { formatDateTime, formatKRW, PLATFORM_LABEL } from '../lib/format.js'
import AccountForm from './AccountForm.jsx'

const TOKEN_KEY = 'portal_token'

export default function Portal() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))

  if (!token) {
    return <LoginFlow onLoggedIn={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t) }} />
  }

  return (
    <PortalHome
      token={token}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      }}
    />
  )
}

function LoginFlow({ onLoggedIn }) {
  const [step, setStep] = useState('phone') // 'phone' | 'code'
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [needName, setNeedName] = useState(false)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleRequestOtp(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await portalApi.requestOtp(phone.trim(), needName ? name.trim() : undefined)
      setMessage('인증번호를 보냈습니다. 문자로 받은 6자리 번호를 입력해주세요.')
      setStep('code')
    } catch (err) {
      if (err.message.includes('등록된 번호가 아닙니다')) {
        setNeedName(true)
        setError('처음 오셨네요! 이름을 입력하고 다시 눌러주세요.')
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
      const result = await portalApi.verifyOtp(phone.trim(), code.trim())
      onLoggedIn(result.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-lg font-semibold text-slate-900">리뷰어 포털</h1>

      {step === 'phone' && (
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500">전화번호</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          {needName && (
            <div>
              <label className="block text-xs text-slate-500">이름 (처음이시면 입력해주세요)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            인증번호 받기
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleVerify} className="space-y-3">
          {message && <p className="text-sm text-green-700">{message}</p>}
          <div>
            <label className="block text-xs text-slate-500">인증번호 (6자리)</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            확인
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  )
}

function PortalHome({ token, onLogout }) {
  const [reviewer, setReviewer] = useState(null)
  const [pool, setPool] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

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

  async function handleSubmitResult(taskId, link) {
    try {
      await portalApi.submitResult(token, taskId, link)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p className="p-6 text-sm text-slate-400">불러오는 중...</p>
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>
  if (!reviewer) return null

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{reviewer.name}님, 안녕하세요</h1>
          <p className="text-sm text-slate-500">{reviewer.contact_info}</p>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <LogOut size={14} />
          로그아웃
        </button>
      </div>

      {!reviewer.is_active && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          관리자 승인 대기 중입니다. 계정 정보는 미리 등록해두실 수 있지만, 승인 후에 작업을
          가져갈 수 있어요.
        </div>
      )}

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-800">내 계정</h2>
        {reviewer.accounts.length === 0 && (
          <p className="text-sm text-slate-400">등록된 계정이 없습니다. 아래에서 추가해주세요.</p>
        )}
        {reviewer.accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                {PLATFORM_LABEL[account.platform]}
              </span>
              <span className="font-medium text-slate-700">{account.label}</span>
            </div>
            <button onClick={() => handleDeleteAccount(account.id)} className="text-slate-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <AccountForm onCreate={handleAddAccount} />
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-800">가능한 작업 (오픈풀)</h2>
        {pool.length === 0 && <p className="text-sm text-slate-400">지금 가져갈 수 있는 작업이 없습니다.</p>}
        {pool.map((task) => (
          <PoolTaskRow
            key={task.id}
            task={task}
            myAccounts={reviewer.accounts.filter((a) => a.platform === task.platform)}
            onClaim={handleClaim}
          />
        ))}
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-800">내 작업</h2>
        {myTasks.length === 0 && <p className="text-sm text-slate-400">진행 중인 작업이 없습니다.</p>}
        {myTasks.map((task) => (
          <MyTaskRow key={task.id} task={task} onSubmitResult={handleSubmitResult} />
        ))}
      </section>
    </div>
  )
}

function PoolTaskRow({ task, myAccounts, onClaim }) {
  const [accountId, setAccountId] = useState(myAccounts[0]?.id ?? '')

  return (
    <div className="flex items-center justify-between rounded border border-slate-100 px-3 py-2 text-sm">
      <div>
        <div className="font-medium text-slate-700">{task.store_name}</div>
        <div className="text-xs text-slate-500">
          {PLATFORM_LABEL[task.platform]} · 건당 {formatKRW(task.settlement_amount)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {myAccounts.length > 1 && (
          <select
            value={accountId}
            onChange={(e) => setAccountId(Number(e.target.value))}
            className="rounded border border-slate-300 px-1.5 py-1 text-xs"
          >
            {myAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={() => onClaim(task.id, accountId)}
          disabled={!accountId}
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
        >
          할게요
        </button>
      </div>
    </div>
  )
}

function MyTaskRow({ task, onSubmitResult }) {
  const [link, setLink] = useState('')
  const canSubmit = task.status === 'ready' || (task.platform === 'kakao' && task.status === 'claimed')

  return (
    <div className="rounded border border-slate-100 px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-medium text-slate-700">{task.store_name}</div>
        <span className="text-xs text-slate-500">{PLATFORM_LABEL[task.platform]}</span>
      </div>
      {task.claim_deadline && task.status !== 'completed' && (
        <div className="text-xs text-slate-500">기한: {formatDateTime(task.claim_deadline)}</div>
      )}
      {task.status === 'completed' ? (
        <a href={task.result_link} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
          제출한 결과 보기
        </a>
      ) : canSubmit ? (
        <div className="mt-1 flex gap-1">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="결과 링크"
            className="w-40 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
          />
          <button
            onClick={() => link.trim() && onSubmitResult(task.id, link.trim())}
            className="rounded bg-slate-800 px-2 py-0.5 text-xs text-white hover:bg-slate-700"
          >
            제출
          </button>
        </div>
      ) : (
        <div className="mt-1 text-xs text-slate-400">
          {task.platform === 'naver' ? '날짜 확인 중이에요, 잠시만 기다려주세요' : '진행 중'}
        </div>
      )}
    </div>
  )
}

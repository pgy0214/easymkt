import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { formatKRW, PLATFORM_LABEL } from '../lib/format.js'

export default function AssignTaskModal({ reviewer, onClose, onAssigned }) {
  const [accountId, setAccountId] = useState(reviewer.accounts[0]?.id ?? '')
  const [openTasks, setOpenTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .getTasks({ status: 'open' })
      .then(setOpenTasks)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const account = reviewer.accounts.find((a) => a.id === Number(accountId))

  const campaigns = useMemo(() => {
    if (!account) return []
    const byTarget = new Map()
    for (const task of openTasks) {
      if (task.platform !== account.platform) continue
      const key = task.review_target_id
      if (!byTarget.has(key)) {
        byTarget.set(key, {
          review_target_id: key,
          store_name: task.store_name,
          store_url: task.store_url,
          unit_price: task.settlement_amount,
          firstTaskId: task.id,
          count: 0,
        })
      }
      byTarget.get(key).count += 1
    }
    return Array.from(byTarget.values())
  }, [openTasks, account])

  async function handleAssign(campaign) {
    if (!account) return
    setAssigningId(campaign.review_target_id)
    setError(null)
    try {
      await api.assignTask(campaign.firstTaskId, account.id)
      onAssigned()
    } catch (err) {
      setError(err.message)
    } finally {
      setAssigningId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg space-y-4 rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-slate-800">{reviewer.name} — 작업 배정</h3>

        {reviewer.accounts.length === 0 ? (
          <p className="text-sm text-slate-400">이 리뷰어는 등록된 계정이 없어 배정할 수 없습니다.</p>
        ) : (
          <>
            <div>
              <label className="block text-xs text-slate-500">배정할 계정</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
              >
                {reviewer.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{PLATFORM_LABEL[a.platform]}] {a.label}
                  </option>
                ))}
              </select>
            </div>

            {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
            {!loading && campaigns.length === 0 && (
              <p className="text-sm text-slate-400">
                이 계정 플랫폼으로 배정 가능한 오픈풀 작업이 없습니다.
              </p>
            )}
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {campaigns.map((c) => (
                <div
                  key={c.review_target_id}
                  className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium text-slate-700">{c.store_name}</span>
                    <span className="ml-2 text-xs text-slate-400">
                      {c.count}건 남음 · {formatKRW(c.unit_price)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAssign(c)}
                    disabled={assigningId === c.review_target_id}
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {assigningId === c.review_target_id ? '배정 중...' : '배정'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

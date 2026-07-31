import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'

/**
 * 일괄 작업 배분 모달 — 선택 단위가 호출부마다 다르다(관리자계정: 1행=1계정,
 * 리뷰어관리: 1명=계정 여러 개일 수 있음). 그래서 entities를 그대로 받고
 * resolveAccount(entity, platform)로 "이 entity가 이 매장 플랫폼에서 쓸 계정"을
 * 호출부가 알려주도록 일반화했다 — 관리자계정은 자기 자신을, 리뷰어관리는
 * reviewer.accounts 중 플랫폼이 맞는 계정을 찾아 반환하면 된다.
 */
export default function BulkAssignModal({
  entities,
  getDisplayName,
  resolveAccount,
  unitLabel = '건',
  onClose,
  onDone,
}) {
  const [stores, setStores] = useState([])
  const [storeFilter, setStoreFilter] = useState('')
  const [openTasks, setOpenTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getStores().then(setStores).catch((err) => setError(err.message))
  }, [])

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === Number(storeFilter)) ?? null,
    [stores, storeFilter],
  )

  const matchingPairs = useMemo(() => {
    if (!selectedStore) return []
    return entities
      .map((entity) => ({ entity, account: resolveAccount(entity, selectedStore.platform) }))
      .filter((pair) => pair.account != null)
  }, [entities, selectedStore, resolveAccount])

  useEffect(() => {
    if (!selectedStore) {
      setOpenTasks([])
      return
    }
    let cancelled = false
    setLoadingTasks(true)
    api
      .getTasks({ status: 'open', platform: selectedStore.platform })
      .then((tasks) => {
        if (cancelled) return
        setOpenTasks(tasks.filter((t) => t.store_id === selectedStore.id))
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingTasks(false))
    return () => {
      cancelled = true
    }
  }, [selectedStore])

  const assignableCount = Math.min(matchingPairs.length, openTasks.length)

  async function handleAssign() {
    setAssigning(true)
    setError(null)
    let success = 0
    const failed = []
    for (let i = 0; i < assignableCount; i++) {
      const { entity, account } = matchingPairs[i]
      const task = openTasks[i]
      try {
        await api.assignTask(task.id, account.id)
        success += 1
      } catch (err) {
        failed.push({ name: getDisplayName(entity), reason: err.message })
      }
    }
    setResult({ success, failed })
    setAssigning(false)
    onDone?.()
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
        <h3 className="font-semibold text-slate-800">
          선택 일괄 작업 배분 ({entities.length}{unitLabel} 선택됨)
        </h3>

        <div>
          <label className="block text-xs text-slate-500">배정할 매장</label>
          <select
            value={storeFilter}
            onChange={(e) => {
              setStoreFilter(e.target.value)
              setResult(null)
            }}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">매장을 선택하세요</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                [{s.platform === 'naver' ? '네이버' : '카카오'}] {s.name}
              </option>
            ))}
          </select>
        </div>

        {selectedStore && (
          <div className="space-y-1 rounded border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
            <p>선택 중 이 매장 플랫폼과 일치: {matchingPairs.length}{unitLabel}</p>
            <p>{loadingTasks ? '오픈풀 작업 수 확인 중...' : `이 매장의 오픈풀 잔여 작업: ${openTasks.length}건`}</p>
            <p className="font-medium text-slate-800">
              → 최대 {assignableCount}건 배정 시도 (쿨다운 등으로 서버가 개별 거부할 수 있음)
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-1 rounded border border-blue-100 bg-blue-50 p-3 text-sm">
            <p className="font-medium text-blue-800">배정 완료: 성공 {result.success}건 · 실패 {result.failed.length}건</p>
            {result.failed.length > 0 && (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-slate-600">
                {result.failed.map((f, i) => (
                  <li key={i}>
                    {f.name} — {f.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={!selectedStore || assignableCount === 0 || assigning}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {assigning ? '배정 중...' : `${assignableCount}건 배정`}
          </button>
        </div>
      </div>
    </div>
  )
}

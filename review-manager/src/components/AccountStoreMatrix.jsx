import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { formatDate } from '../lib/format.js'

export default function AccountStoreMatrix({ accounts }) {
  const [historyByAccount, setHistoryByAccount] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (accounts.length === 0) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all(accounts.map((a) => api.getAccountStoreHistory(a.id)))
      .then((results) => {
        const map = {}
        accounts.forEach((a, i) => {
          map[a.id] = results[i]
        })
        setHistoryByAccount(map)
      })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.map((a) => a.id).join(',')])

  if (accounts.length === 0) return null
  if (loading) {
    return <p className="mt-2 text-xs text-slate-400">매장 이력 불러오는 중...</p>
  }

  const storeMap = new Map()
  Object.values(historyByAccount)
    .flat()
    .forEach((item) => storeMap.set(item.store_id, item.store_name))
  const stores = Array.from(storeMap.entries()).map(([id, name]) => ({ id, name }))

  if (stores.length === 0) {
    return (
      <p className="mt-2 text-xs text-slate-400">
        아직 완료된 작업이 없어 매장별 이력이 없습니다. 작업을 완료하면 여기에 계정×매장 표가 표시됩니다.
      </p>
    )
  }

  return (
    <div className="mt-2 overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left">계정</th>
            {stores.map((store) => (
              <th key={store.id} className="border border-slate-200 bg-slate-50 px-2 py-1 text-left">
                {store.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => {
            const history = historyByAccount[account.id] || []
            const byStore = new Map(history.map((h) => [h.store_id, h]))
            return (
              <tr key={account.id}>
                <td className="border border-slate-200 px-2 py-1 font-medium text-slate-700">
                  {account.label}
                </td>
                {stores.map((store) => {
                  const item = byStore.get(store.id)
                  return (
                    <td key={store.id} className="border border-slate-200 px-2 py-1">
                      {!item ? (
                        <span className="text-slate-300">-</span>
                      ) : item.is_eligible_now ? (
                        <span className="text-green-700">
                          {formatDate(item.last_completed_at)} 완료 · 재작업 가능
                        </span>
                      ) : (
                        <span className="text-amber-600">
                          {formatDate(item.last_completed_at)} 완료 · {formatDate(item.eligible_at)}부터 가능
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

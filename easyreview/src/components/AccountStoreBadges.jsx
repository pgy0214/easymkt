import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

function shortDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function AccountStoreBadges({ account }) {
  const [stores, setStores] = useState([])
  const [history, setHistory] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.getStores(account.platform), api.getAccountStoreHistory(account.id)]).then(
      ([storeList, historyList]) => {
        if (cancelled) return
        setStores(storeList)
        setHistory(historyList)
        setLoaded(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [account.id, account.platform])

  if (!loaded || stores.length === 0) return null

  const byStore = new Map(history.map((h) => [h.store_id, h]))

  return (
    <div className="flex flex-wrap items-center gap-1">
      {stores.map((store) => {
        const item = byStore.get(store.id)
        if (!item) {
          return (
            <span
              key={store.id}
              className="rounded-pill bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-400"
            >
              {store.name} -
            </span>
          )
        }
        return (
          <span
            key={store.id}
            title={`${store.name}: ${shortDate(item.last_completed_at)} 완료${
              item.is_eligible_now ? ' · 재작업 가능' : ` · ${shortDate(item.eligible_at)}부터 가능`
            }`}
            className={`rounded-pill px-1.5 py-0.5 text-[11px] font-medium ${
              item.is_eligible_now ? 'bg-success-bg text-success-text' : 'bg-warning-bg text-warning-text'
            }`}
          >
            {store.name} {shortDate(item.last_completed_at)}
          </span>
        )
      })}
    </div>
  )
}

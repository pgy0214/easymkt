import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

function shortDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function AccountStoreBadges({ accountId }) {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.getAccountStoreHistory(accountId).then((data) => {
      if (!cancelled) setHistory(data)
    })
    return () => {
      cancelled = true
    }
  }, [accountId])

  if (!history || history.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      {history.map((item) => (
        <span
          key={item.store_id}
          title={`${item.store_name}: ${shortDate(item.last_completed_at)} 완료${
            item.is_eligible_now ? ' · 재작업 가능' : ` · ${shortDate(item.eligible_at)}부터 가능`
          }`}
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
            item.is_eligible_now ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {item.store_name} {shortDate(item.last_completed_at)}
        </span>
      ))}
    </div>
  )
}

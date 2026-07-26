function toDateInput(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function DateRangePicker({ from, to, onChange }) {
  function setRange(fromDate, toDate) {
    onChange({ from: toDateInput(fromDate), to: toDateInput(toDate) })
  }

  function today() {
    const now = new Date()
    setRange(now, now)
  }

  function thisMonth() {
    const now = new Date()
    setRange(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0))
  }

  function lastMonth() {
    const now = new Date()
    setRange(new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0))
  }

  function thisYear() {
    const now = new Date()
    setRange(new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={from}
        onChange={(e) => onChange({ from: e.target.value, to })}
        className="rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <span className="text-slate-400">~</span>
      <input
        type="date"
        value={to}
        onChange={(e) => onChange({ from, to: e.target.value })}
        className="rounded border border-slate-300 px-2 py-1 text-sm"
      />
      <button type="button" onClick={today} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
        오늘
      </button>
      <button type="button" onClick={thisMonth} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
        이번달
      </button>
      <button type="button" onClick={lastMonth} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
        저번달
      </button>
      <button type="button" onClick={thisYear} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
        올해
      </button>
      <button
        type="button"
        onClick={() => onChange({ from: '', to: '' })}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-400 hover:bg-slate-50"
      >
        전체
      </button>
    </div>
  )
}

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import TaskRow from './TaskRow.jsx'

export default function TaskTable({
  tasks,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onRecheckOne,
  rechecking,
  onSubmitResult,
  onUpdateSettlement,
}) {
  const [collapsed, setCollapsed] = useState(() => new Set())

  if (tasks.length === 0) {
    return <p className="text-sm text-gray-400">조건에 맞는 작업이 없습니다</p>
  }

  const groups = new Map()
  for (const task of tasks) {
    const key = task.store_name || '매장 미지정'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(task)
  }

  function toggleCollapsed(storeName) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(storeName)) next.delete(storeName)
      else next.add(storeName)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {Array.from(groups.entries()).map(([storeName, storeTasks]) => {
        const total = storeTasks.length
        const remaining = storeTasks.filter((t) => t.status === 'open').length
        const completedIds = storeTasks.filter((t) => t.status === 'completed').map((t) => t.id)
        const isCollapsed = collapsed.has(storeName)

        return (
          <div key={storeName} className="overflow-hidden rounded-card border border-gray-200 bg-white">
            <button
              type="button"
              onClick={() => toggleCollapsed(storeName)}
              className="flex w-full items-center justify-between gap-2 bg-gray-50 px-3 py-2 text-left hover:bg-gray-100"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                {storeName}
              </span>
              <span className="text-xs font-normal text-gray-500">
                진행 {remaining}/{total} · 남음
              </span>
            </button>
            {!isCollapsed && (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={completedIds.length === 0}
                          checked={
                            completedIds.length > 0 && completedIds.every((id) => selectedIds.has(id))
                          }
                          onChange={() => onToggleSelectAll(completedIds)}
                          title="이 매장의 완료된 작업 전체 선택"
                        />
                      </th>
                      <th className="px-3 py-2">리뷰어 / 계정</th>
                      <th className="px-3 py-2">플랫폼</th>
                      <th className="px-3 py-2">상태</th>
                      <th className="px-3 py-2">날짜</th>
                      <th className="px-3 py-2">결과</th>
                      <th className="px-3 py-2">블라인드</th>
                      <th className="px-3 py-2">정산</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {storeTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        selected={selectedIds.has(task.id)}
                        onToggleSelect={onToggleSelect}
                        onRecheckOne={onRecheckOne}
                        rechecking={rechecking}
                        onSubmitResult={onSubmitResult}
                        onUpdateSettlement={onUpdateSettlement}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

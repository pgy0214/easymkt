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
  if (tasks.length === 0) {
    return <p className="text-sm text-slate-400">조건에 맞는 작업이 없습니다</p>
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2">
              <input
                type="checkbox"
                disabled={completedCount === 0}
                onChange={onToggleSelectAll}
                title="완료된 작업 전체 선택"
              />
            </th>
            <th className="px-3 py-2">리뷰어 / 계정</th>
            <th className="px-3 py-2">가게</th>
            <th className="px-3 py-2">상태</th>
            <th className="px-3 py-2">날짜</th>
            <th className="px-3 py-2">결과</th>
            <th className="px-3 py-2">블라인드</th>
            <th className="px-3 py-2">정산</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((task) => (
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
  )
}

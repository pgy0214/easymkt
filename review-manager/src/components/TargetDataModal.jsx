import { useEffect, useState } from 'react'
import { API_ORIGIN, api } from '../lib/api.js'
import { formatDateTime, formatKRW, PLATFORM_LABEL, STATUS_LABEL } from '../lib/format.js'

export default function TargetDataModal({ targetId, onClose }) {
  const [target, setTarget] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .getTarget(targetId)
      .then(setTarget)
      .catch((err) => setError(err.message))
  }, [targetId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">
            작업데이터{target ? ` — ${target.store_name}` : ''}
          </h3>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-700">
            닫기
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!target && !error && <p className="text-sm text-slate-400">불러오는 중...</p>}

        {target && (
          <div className="space-y-5">
            <section className="space-y-2 rounded border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="text-xs font-medium text-slate-500">리뷰 원고 자료</p>
              {!target.guideline &&
                !target.regional_features &&
                !(target.menu_items?.length > 0) &&
                !target.reference_photo_path &&
                !(target.photos?.length > 0) && (
                  <p className="text-slate-400">등록된 원고 자료가 없습니다.</p>
                )}
              {target.guideline && (
                <div>
                  <p className="text-xs text-slate-500">원고 가이드라인</p>
                  <p className="whitespace-pre-wrap text-slate-700">{target.guideline}</p>
                </div>
              )}
              {target.regional_features && (
                <div>
                  <p className="text-xs text-slate-500">지역적 특징</p>
                  <p className="whitespace-pre-wrap text-slate-700">{target.regional_features}</p>
                </div>
              )}
              {target.menu_items?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500">메뉴</p>
                  <ul className="text-slate-700">
                    {target.menu_items.map((item, i) => (
                      <li key={i}>
                        {item.name} — {formatKRW(item.price)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {target.reference_photo_path && (
                <div>
                  <p className="text-xs text-slate-500">참고 이미지</p>
                  <img
                    src={`${API_ORIGIN}${target.reference_photo_path}`}
                    alt="참고 이미지"
                    className="mt-1 max-h-48 rounded border border-slate-200"
                  />
                </div>
              )}
              {target.photos?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500">
                    사진 풀 (총 {target.photos.length}장 · 리뷰당 {target.photos_per_review}장 배정)
                  </p>
                  <div className="mt-1 grid grid-cols-4 gap-1">
                    {target.photos.map((photo) => (
                      <img
                        key={photo.id}
                        src={`${API_ORIGIN}${photo.file_path}`}
                        alt="캠페인 사진"
                        className="aspect-square rounded border border-slate-200 object-cover"
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <p className="text-xs font-medium text-slate-500">
                작업 목록 (건별) — 총 {target.tasks.length}건
              </p>
              {target.tasks.length === 0 && (
                <p className="text-sm text-slate-400">등록된 작업이 없습니다.</p>
              )}
              <div className="space-y-2">
                {target.tasks.map((task) => (
                  <TaskDataRow key={task.id} task={task} />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function TaskDataRow({ task }) {
  return (
    <div className="rounded border border-slate-100 p-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">#{task.id}</span>
          <span className="font-medium text-slate-700">{STATUS_LABEL[task.status] ?? task.status}</span>
          <span className="text-xs text-slate-400">{PLATFORM_LABEL[task.platform]}</span>
        </div>
        <div className="text-xs text-slate-500">
          {task.reviewer_name
            ? `${task.reviewer_name}${task.account_label ? ` (${task.account_label})` : ''}`
            : '미배정'}
        </div>
      </div>
      {task.claimed_at && (
        <div className="mt-0.5 text-xs text-slate-400">클레임: {formatDateTime(task.claimed_at)}</div>
      )}
      {task.result_link && (
        <div className="mt-0.5 text-xs">
          <a
            href={task.result_link}
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 hover:underline"
          >
            제출한 결과 보기
          </a>
        </div>
      )}
      {task.assigned_photo_paths?.length > 0 && (
        <div className="mt-1">
          <p className="text-xs text-slate-500">배정된 사진 ({task.assigned_photo_paths.length}장)</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {task.assigned_photo_paths.map((path) => (
              <img
                key={path}
                src={`${API_ORIGIN}${path}`}
                alt="배정된 사진"
                className="h-16 w-16 rounded border border-slate-200 object-cover"
              />
            ))}
          </div>
        </div>
      )}
      {task.receipt_image_path ? (
        <div className="mt-1">
          <p className="text-xs text-slate-500">영수증 이미지</p>
          <img
            src={`${API_ORIGIN}${task.receipt_image_path}`}
            alt="영수증 이미지"
            className="mt-1 max-h-64 rounded border border-slate-200"
          />
        </div>
      ) : (
        <div className="mt-1 text-xs text-slate-400">영수증 미생성</div>
      )}
    </div>
  )
}

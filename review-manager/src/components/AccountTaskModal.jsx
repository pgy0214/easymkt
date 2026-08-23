import { ChevronDown, ChevronRight, Play, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { API_ORIGIN, api } from '../lib/api.js'
import { formatDate, formatKRW, STATUS_LABEL } from '../lib/format.js'
import CopyButton from './CopyButton.jsx'
import ImageCopyButton from './ImageCopyButton.jsx'
import Button from './ui/Button.jsx'
import Modal from './ui/Modal.jsx'

function HistoryRow({ task, onSubmitResult, onUploadReceipt }) {
  const [linkInput, setLinkInput] = useState('')
  const [showMaterials, setShowMaterials] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const canEnterResult = task.status === 'ready' || (task.platform === 'kakao' && task.status === 'claimed')
  const isCompleted = task.status === 'completed'
  const hasMaterials =
    task.assigned_review_text || task.assigned_photo_paths?.length > 0 || task.receipt_image_path

  async function handleReceiptFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingReceipt(true)
    try {
      await onUploadReceipt(task.id, file)
    } catch (err) {
      alert(err.message)
    } finally {
      setUploadingReceipt(false)
    }
  }

  return (
    <>
      <tr>
        <td className="px-2 py-1.5 text-gray-700">
          <div className="flex items-center gap-1">
            {(hasMaterials || task.platform === 'naver') && (
              <button
                type="button"
                onClick={() => setShowMaterials((v) => !v)}
                className="text-gray-400 hover:text-brand-600"
                title="원고/사진/영수증 보기"
              >
                {showMaterials ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            {task.store_name || '-'}
          </div>
        </td>
        <td className="px-2 py-1.5 text-gray-500">{STATUS_LABEL[task.status] ?? task.status}</td>
        <td className="px-2 py-1.5 text-xs text-gray-500">
          {task.platform === 'naver' && <div>영수증: {formatDate(task.naver_available_date)}</div>}
          <div>작성일: {formatDate(task.review_posted_date)}</div>
        </td>
        <td className="px-2 py-1.5">
          {isCompleted ? (
            <a
              href={task.result_link}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline"
            >
              결과 보기
            </a>
          ) : canEnterResult ? (
            <div className="flex gap-1">
              <input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="결과 링크"
                className="w-28 rounded-btn border border-gray-300 px-1.5 py-0.5 text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                className="px-2 py-0.5"
                onClick={() => linkInput.trim() && onSubmitResult(task.id, linkInput.trim())}
              >
                완료
              </Button>
            </div>
          ) : (
            <span className="text-xs text-gray-400">대기중</span>
          )}
        </td>
      </tr>
      {showMaterials && (
        <tr>
          <td colSpan={4} className="bg-gray-50 px-3 py-2">
            <div className="space-y-2">
              {task.account_profile_url && (
                <a
                  href={task.account_profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-btn border border-brand-300 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                >
                  작업하러가기
                </a>
              )}
              {task.assigned_review_text && (
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-gray-500">배정된 리뷰 원고</p>
                    <CopyButton value={task.assigned_review_text} label="원고" />
                  </div>
                  <p className="mt-1 whitespace-pre-wrap rounded border border-gray-200 bg-white p-1.5 text-xs text-gray-700">
                    {task.assigned_review_text}
                  </p>
                </div>
              )}
              {task.assigned_photo_paths?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500">배정된 사진 ({task.assigned_photo_paths.length}장)</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {task.assigned_photo_paths.map((path) => (
                      <div key={path} className="space-y-1">
                        <img
                          src={`${API_ORIGIN}${path}`}
                          alt="배정된 사진"
                          className="h-16 w-16 rounded border border-gray-200 object-cover"
                        />
                        <ImageCopyButton src={`${API_ORIGIN}${path}`} label="복사" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {task.receipt_image_path && (
                <div>
                  <p className="text-xs text-gray-500">영수증 이미지</p>
                  <img
                    src={`${API_ORIGIN}${task.receipt_image_path}`}
                    alt="영수증 이미지"
                    className="mt-1 max-h-64 rounded border border-gray-200"
                  />
                  <div className="mt-1">
                    <ImageCopyButton src={`${API_ORIGIN}${task.receipt_image_path}`} label="영수증 복사" />
                  </div>
                </div>
              )}
              {task.platform === 'naver' && (
                <div>
                  <label className="inline-block cursor-pointer rounded-btn border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                    {uploadingReceipt
                      ? '업로드 중...'
                      : task.receipt_image_path
                        ? '영수증 이미지 교체'
                        : '영수증 이미지 업로드'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingReceipt}
                      onChange={handleReceiptFileChange}
                    />
                  </label>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function AccountTaskModal({ row, onClose }) {
  const [openTasks, setOpenTasks] = useState([])
  const [history, setHistory] = useState([])
  const [storeHistory, setStoreHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState(null)
  const [error, setError] = useState(null)
  const [storeSearch, setStoreSearch] = useState('')
  const [launching, setLaunching] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const [open, hist, storeHist] = await Promise.all([
        api.getTasks({ status: 'open', platform: row.platform }),
        api.getTasks({ account_id: row.id }),
        api.getAccountStoreHistory(row.id),
      ])
      setOpenTasks(open)
      setHistory(hist)
      setStoreHistory(storeHist)
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
  }, [row.id])

  const eligibilityByStore = useMemo(
    () => new Map(storeHistory.map((h) => [h.store_id, h])),
    [storeHistory],
  )

  const campaigns = useMemo(() => {
    const byTarget = new Map()
    for (const task of openTasks) {
      const key = task.review_target_id
      if (!byTarget.has(key)) {
        const eligibility = eligibilityByStore.get(task.store_id)
        byTarget.set(key, {
          review_target_id: key,
          store_id: task.store_id,
          store_name: task.store_name,
          unit_price: task.settlement_amount,
          firstTaskId: task.id,
          count: 0,
          isEligible: !eligibility || eligibility.is_eligible_now,
          eligibleAt: eligibility?.eligible_at,
        })
      }
      byTarget.get(key).count += 1
    }
    return Array.from(byTarget.values())
  }, [openTasks, eligibilityByStore])

  const filteredCampaigns = useMemo(() => {
    const query = storeSearch.trim().toLowerCase()
    return campaigns
      .filter((c) => !query || (c.store_name || '').toLowerCase().includes(query))
      .filter((c) => c.isEligible)
  }, [campaigns, storeSearch])

  const ineligibleCount = campaigns.length - campaigns.filter((c) => c.isEligible).length

  async function handleAssign(campaign) {
    setAssigningId(campaign.review_target_id)
    setError(null)
    try {
      await api.assignTask(campaign.firstTaskId, row.id)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setAssigningId(null)
    }
  }

  async function handleLaunch() {
    setLaunching(true)
    try {
      await api.launchAccount(row.id)
    } catch (err) {
      alert(err.message)
    } finally {
      setLaunching(false)
    }
  }

  async function handleSubmitResult(taskId, link) {
    try {
      await api.updateTaskResult(taskId, link)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleUploadReceipt(taskId, file) {
    await api.uploadTaskReceiptImage(taskId, file)
    await refresh()
  }

  return (
    <Modal open onClose={onClose} size="2xl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">
          {row.name} — {row.label} 작업 관리
        </h3>
        {row.adspower_profile_id && (
          <Button variant="primary" size="sm" onClick={handleLaunch} disabled={launching}>
            <Play size={12} />
            {launching ? '실행 중...' : '지금 실행'}
          </Button>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-gray-500">
          새 작업 배정 (오픈풀)
          {ineligibleCount > 0 && (
            <span className="ml-1 font-normal text-warning-text">
              · 쿨다운 중이라 안 보이는 매장 {ineligibleCount}곳
            </span>
          )}
        </p>
        {campaigns.length > 0 && (
          <div className="relative mb-1 w-48">
            <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              placeholder="매장명 검색"
              className="w-full rounded-btn border border-gray-300 py-1 pl-6 pr-2 text-xs"
            />
          </div>
        )}
        {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
        {!loading && campaigns.length === 0 && (
          <p className="text-sm text-gray-400">
            이 계정 플랫폼으로 배정 가능한 오픈풀 작업이 없습니다.
          </p>
        )}
        {!loading && campaigns.length > 0 && filteredCampaigns.length === 0 && (
          <p className="text-sm text-gray-400">
            {storeSearch ? '검색 조건에 맞는 매장이 없습니다.' : '쿨다운 때문에 지금 배정 가능한 매장이 없습니다.'}
          </p>
        )}
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {filteredCampaigns.map((c) => (
            <div
              key={c.review_target_id}
              className="flex items-center justify-between rounded-btn border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-gray-700">{c.store_name}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {c.count}건 남음 · {formatKRW(c.unit_price)}
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleAssign(c)}
                disabled={assigningId === c.review_target_id}
              >
                {assigningId === c.review_target_id ? '배정 중...' : '배정'}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <p className="mb-1 text-xs font-medium text-gray-500">작업 내역</p>
        {!loading && history.length === 0 ? (
          <p className="text-sm text-gray-400">이 계정으로 진행한 작업이 없습니다.</p>
        ) : (
          <div className="max-h-64 overflow-auto rounded-card border border-gray-200">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-2 py-1.5">매장</th>
                  <th className="px-2 py-1.5">상태</th>
                  <th className="px-2 py-1.5">날짜</th>
                  <th className="px-2 py-1.5">결과</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((task) => (
                  <HistoryRow
                    key={task.id}
                    task={task}
                    onSubmitResult={handleSubmitResult}
                    onUploadReceipt={handleUploadReceipt}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-danger-text">{error}</p>}

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Modal>
  )
}

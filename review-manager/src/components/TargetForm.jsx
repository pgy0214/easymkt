import { Download, Plus, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { enforceProductNameLength, MAX_PRODUCT_NAME_LENGTH, WEEKDAY_LABELS, parseProductString } from '../lib/format.js'
import TargetList from './TargetList.jsx'

const REVIEW_TEXT_TEMPLATE_HEADERS = ['번호', '리뷰내용']

function downloadReviewTextTemplate() {
  const example = ['1', '여기에 완성된 리뷰 원고를 그대로 붙여넣으세요']
  const csv = '﻿' + REVIEW_TEXT_TEMPLATE_HEADERS.join(',') + '\n' + example.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '캠페인_리뷰원고_양식.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function daysBetween(start, end) {
  if (!start || !end) return null
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1
  return days > 0 ? days : null
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const REVIEW_LENGTH_OPTIONS = [50, 80, 100]

const EMPTY_MENU_ITEM = { name: '', price: '' }

const DEFAULT_GUIDELINE = [
  '1) 한잔 하기 좋고, 칵테일, 위스키메뉴가 많았다.',
  '2) 특이한 칵테일을 먹어보고 싶다면 시그니처 메뉴 칵테일을 먹어봐라.',
  '3) 인스타에 칵테일 사진 올리기 좋다.',
  '4) 외국인들이 많이 방문하는 듯 했다.(동남아, 유럽, 미국 등 다양함)',
  '5) 부산역 바로 옆이라 기차타러 가기전 후에 한번쯤 가보기 좋음.',
].join('\n')

const EMPTY = {
  platform: 'naver',
  store_id: '',
  unit_price: 0,
  sale_price: '',
  daily_limit: 1,
  start_date: '',
  end_date: '',
  work_days: ALL_DAYS,
  guideline: DEFAULT_GUIDELINE,
  regional_features: '',
  menu_items: [{ ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }],
  review_length: 80,
  photos_per_review: 1,
}

function menuItemsFromStore(store) {
  const items = parseProductString(store?.representative_product)
  if (items.length === 0) return null
  return [0, 1, 2].map((i) =>
    items[i] ? { name: items[i].name.slice(0, MAX_PRODUCT_NAME_LENGTH), price: items[i].price } : { ...EMPTY_MENU_ITEM },
  )
}

// work_days는 백엔드와 동일하게 0=월..6=일 — JS Date.getDay()(0=일..6=토)를 변환해서 맞춘다
function countMatchingDays(startDate, endDate, workDays) {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end < start) return 0
  let count = 0
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const mondayBased = (d.getDay() + 6) % 7
    if (workDays.includes(mondayBased)) count++
  }
  return count
}

export default function TargetForm() {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [targets, setTargets] = useState([])
  const [stores, setStores] = useState([])
  const [usePhotos, setUsePhotos] = useState(false)
  const [photoFiles, setPhotoFiles] = useState([])
  const [reviewTextFile, setReviewTextFile] = useState(null)
  const [previewText, setPreviewText] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const photoInputRef = useRef(null)
  const reviewTextInputRef = useRef(null)

  async function refreshTargets() {
    setTargets(await api.getTargets())
  }

  async function refreshStores(platform) {
    const list = await api.getStores(platform)
    setStores(list)
    const firstStore = list[0]
    setForm((prev) => ({
      ...prev,
      store_id: firstStore?.id ?? '',
      menu_items: menuItemsFromStore(firstStore) ?? prev.menu_items,
    }))
  }

  useEffect(() => {
    refreshTargets()
    refreshStores('naver')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePlatformChange(platform) {
    setForm((prev) => ({ ...prev, platform }))
    refreshStores(platform)
  }

  function handleStoreChange(storeId) {
    const selected = stores.find((s) => s.id === Number(storeId))
    setForm((prev) => ({
      ...prev,
      store_id: storeId,
      menu_items: menuItemsFromStore(selected) ?? [{ ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }],
    }))
  }

  function toggleWorkDay(day) {
    setForm((prev) => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter((d) => d !== day)
        : [...prev.work_days, day],
    }))
  }

  function updateMenuItem(index, field, value) {
    setForm((prev) => ({
      ...prev,
      menu_items: prev.menu_items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  async function handlePreviewReviewText() {
    setPreviewing(true)
    setPreviewText(null)
    try {
      const menuItems = form.menu_items
        .filter((item) => item.name.trim() && item.price !== '')
        .map((item) => ({ name: item.name.trim(), price: Number(item.price) }))
      const result = await api.previewReviewText({
        guideline: form.guideline.trim() || null,
        regional_features: form.regional_features.trim() || null,
        review_length: Number(form.review_length),
        menu_items: menuItems.length > 0 ? menuItems : null,
      })
      setPreviewText(result.text)
    } catch (err) {
      alert(err.message)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('이 캠페인을 삭제할까요? (클레임되었거나 완료된 작업이 있으면 삭제할 수 없습니다)')) return
    try {
      await api.deleteTarget(id)
      await refreshTargets()
    } catch (err) {
      alert(err.message)
    }
  }

  function openRegisterModal() {
    setError(null)
    setMessage(null)
    setRegisterModalOpen(true)
  }

  function closeRegisterModal() {
    setRegisterModalOpen(false)
  }

  const dayCount = daysBetween(form.start_date, form.end_date)
  const matchingDays = countMatchingDays(form.start_date, form.end_date, form.work_days)
  const totalCount = matchingDays * (Number(form.daily_limit) || 0)
  const selectedStore = stores.find((s) => s.id === Number(form.store_id))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.store_id) {
      setError('먼저 "매장정보" 탭에서 매장을 등록해주세요.')
      return
    }
    if (form.work_days.length === 0) {
      setError('작업요일을 최소 하루 이상 선택해주세요.')
      return
    }
    if (!form.start_date || !form.end_date) {
      setError('작업 기간(시작일~종료일)을 입력해주세요 — 총 건수 계산에 필요합니다.')
      return
    }
    if (totalCount <= 0) {
      setError('작업 기간/작업요일/1일 작업 갯수를 확인해주세요 — 총 건수가 0건입니다.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const menuItems = form.menu_items
        .filter((item) => item.name.trim() && item.price !== '')
        .map((item) => ({ name: item.name.trim(), price: Number(item.price) }))
      const target = await api.createTarget({
        store_id: Number(form.store_id),
        required_count: totalCount,
        unit_price: Number(form.unit_price),
        sale_price: form.sale_price === '' ? null : Number(form.sale_price),
        work_days: form.work_days,
        daily_limit: Number(form.daily_limit),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        guideline: form.guideline.trim() || null,
        regional_features: form.regional_features.trim() || null,
        menu_items: menuItems.length > 0 ? menuItems : null,
        review_length: Number(form.review_length),
        photos_per_review: usePhotos ? Number(form.photos_per_review) || 1 : 0,
      })
      if (reviewTextFile) {
        await api.uploadTargetReviewTexts(target.id, reviewTextFile)
      }
      if (usePhotos && photoFiles.length > 0) {
        await api.uploadTargetPhotos(target.id, photoFiles)
      }
      setMessage(
        `"${target.store_name}" 등록 완료 — ${target.required_count}건이 오픈풀에 등록되었습니다. 리뷰어가 직접 클레임합니다.`,
      )
      setForm((prev) => ({
        ...EMPTY,
        platform: prev.platform,
        store_id: prev.store_id,
        menu_items: menuItemsFromStore(stores.find((s) => s.id === Number(prev.store_id))) ?? EMPTY.menu_items,
      }))
      setUsePhotos(false)
      setPhotoFiles([])
      setReviewTextFile(null)
      setPreviewText(null)
      setRegisterModalOpen(false)
      await refreshTargets()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">캠페인 목록</h2>
        <button
          type="button"
          onClick={openRegisterModal}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          <Plus size={14} />
          캠페인 등록
        </button>
      </div>

      {message && <p className="text-sm text-green-700">{message}</p>}

      <TargetList targets={targets} onDelete={handleDelete} onUpdated={refreshTargets} />

      {registerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeRegisterModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">캠페인 등록</h3>
              <button type="button" onClick={closeRegisterModal} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs text-slate-500">플랫폼</label>
                <select
                  value={form.platform}
                  onChange={(e) => handlePlatformChange(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value="naver">네이버영수증</option>
                  <option value="kakao">카카오맵</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500">매장</label>
                <select
                  value={form.store_id}
                  onChange={(e) => handleStoreChange(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  {stores.length === 0 && <option value="">등록된 매장 없음</option>}
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500">리뷰어 단가 (원)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500">판매단가 (원, 선택)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.sale_price}
                    onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                    placeholder="비워두면 매출 집계에서 제외"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500">
                  작업 기간 (총 건수 계산에 사용됩니다)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-slate-400">~</span>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  {dayCount != null && (
                    <span className="text-xs font-medium text-slate-500">{dayCount}일간</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500">작업요일 (선택한 요일에만 오픈풀에 노출)</label>
                <div className="mt-1 flex gap-1">
                  {WEEKDAY_LABELS.map((label, day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWorkDay(day)}
                      className={`h-7 w-7 rounded text-xs font-medium ${
                        form.work_days.includes(day)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500">1일 작업 갯수 (하루에 이만큼만 오픈풀에서 클레임 가능)</label>
                <input
                  type="number"
                  min="1"
                  value={form.daily_limit}
                  onChange={(e) => setForm({ ...form, daily_limit: e.target.value })}
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
              <div className="rounded border border-blue-100 bg-blue-50 p-2">
                <label className="block text-xs text-slate-500">건수 (작업기간 × 작업요일 × 1일 작업 갯수로 자동 계산)</label>
                <input
                  type="number"
                  value={totalCount}
                  disabled
                  className="w-full rounded border border-slate-200 bg-slate-100 px-2 py-1 text-sm text-slate-500"
                />
              </div>
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500">
                  리뷰 원고 자료 (리뷰어가 포털에서 "리뷰 자료 보기"로 확인)
                </p>
                <div>
                  <label className="block text-xs text-slate-500">
                    원고 가이드라인 (엑셀 업로드분이 부족할 때 AI가 참고하는 예시 — 자유롭게 고쳐서 쓰세요)
                  </label>
                  <div className="mt-1 rounded border border-slate-200 bg-slate-50 p-2">
                    <textarea
                      value={form.guideline}
                      onChange={(e) => setForm({ ...form, guideline: e.target.value })}
                      rows={6}
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">지역적 특징</label>
                  <textarea
                    value={form.regional_features}
                    onChange={(e) => setForm({ ...form, regional_features: e.target.value })}
                    rows={2}
                    placeholder="예: 근처 관광지, 교통 접근성 등 리뷰에 녹일 수 있는 지역 특징"
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">리뷰 글자수</label>
                  <div className="mt-1 flex items-center gap-1">
                    {REVIEW_LENGTH_OPTIONS.map((len) => (
                      <button
                        key={len}
                        type="button"
                        onClick={() => setForm({ ...form, review_length: len })}
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          Number(form.review_length) === len
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {len}자
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handlePreviewReviewText}
                      disabled={previewing}
                      className="ml-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {previewing ? '생성 중...' : '예시 보기'}
                    </button>
                  </div>
                  {previewText && (
                    <p className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                      {previewText}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-slate-500">
                    메뉴 3개 (매장정보의 대표상품에서 자동으로 채워집니다 — 이 캠페인만 다르게
                    쓰려면 직접 수정하세요. 영수증 이미지 생성에도 사용됩니다)
                  </label>
                  {selectedStore && !selectedStore.representative_product && (
                    <p className="mt-1 text-xs text-amber-600">
                      이 매장은 대표상품이 등록되어 있지 않아요. "매장정보"에서 먼저 등록해주세요.
                    </p>
                  )}
                  <div className="space-y-1">
                    {form.menu_items.map((item, i) => (
                      <div key={i} className="flex gap-1">
                        <input
                          value={item.name}
                          onChange={(e) => updateMenuItem(i, 'name', enforceProductNameLength(e.target.value))}
                          placeholder={`메뉴명 ${i + 1} (최대 ${MAX_PRODUCT_NAME_LENGTH}자)`}
                          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <input
                          type="number"
                          min="0"
                          value={item.price}
                          onChange={(e) => updateMenuItem(i, 'price', e.target.value)}
                          placeholder="가격"
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="block text-xs text-slate-500">
                      리뷰 원고 엑셀 업로드 (번호+리뷰내용 — 작업 건수만큼 순서대로 배정되고, 부족한 만큼은 위 가이드라인으로 AI가 자동 생성합니다)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        ref={reviewTextInputRef}
                        type="file"
                        accept=".xlsx,.csv"
                        onChange={(e) => setReviewTextFile(e.target.files[0] || null)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => reviewTextInputRef.current?.click()}
                        className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        <Upload size={12} />
                        엑셀 선택
                      </button>
                      <button
                        type="button"
                        onClick={downloadReviewTextTemplate}
                        className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        <Download size={12} />
                        샘플 양식
                      </button>
                    </div>
                  </div>
                  {reviewTextFile && (
                    <span className="mt-1 flex w-fit items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {reviewTextFile.name}
                      <button
                        type="button"
                        onClick={() => {
                          setReviewTextFile(null)
                          if (reviewTextInputRef.current) reviewTextInputRef.current.value = ''
                        }}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={usePhotos}
                      onChange={(e) => setUsePhotos(e.target.checked)}
                    />
                    사진을 리뷰에 사용
                  </label>
                  {usePhotos && (
                    <div className="mt-2 space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
                      <div>
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) =>
                            setPhotoFiles((prev) => [...prev, ...Array.from(e.target.files || [])])
                          }
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <Upload size={12} />
                          사진 업로드하기
                        </button>
                        {photoFiles.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {photoFiles.map((f, i) => (
                              <span
                                key={`${f.name}-${i}`}
                                className="flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs text-slate-600"
                              >
                                {f.name}
                                <button
                                  type="button"
                                  onClick={() => setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                  className="text-slate-400 hover:text-red-600"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-slate-400">
                          업로드한 사진은 저장 전 EXIF(촬영정보)가 자동으로 랜덤 처리됩니다.
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500">리뷰당 사진 갯수</label>
                        <input
                          type="number"
                          min="1"
                          value={form.photos_per_review}
                          onChange={(e) => setForm((prev) => ({ ...prev, photos_per_review: e.target.value }))}
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={submitting || !form.store_id}
                  className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  등록 (오픈풀에 공개)
                </button>
              </div>
              <p className="text-xs text-slate-400">
                매장 목록에 없다면 먼저 "매장정보" 탭에서 등록해주세요. 등록된 작업은 자동
                배정되지 않고 오픈풀에 공개되며, 리뷰어가 셀프서비스 포털의 "가능한 작업 (오픈풀)"
                목록에서 직접 "할게요"를 눌러 클레임합니다. 작업 제한시간(리뷰어가 클레임 후 결과
                링크를 제출해야 하는 시간)은 "설정" 탭에서 관리합니다.
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

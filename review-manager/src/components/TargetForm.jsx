import { Download, Plus, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { enforceProductNameLength, MAX_PRODUCT_NAME_LENGTH, WEEKDAY_LABELS, parseProductString } from '../lib/format.js'
import TargetList from './TargetList.jsx'

const GUIDELINE_TEMPLATE_HEADERS = [
  '가이드라인',
  '지역특징',
  '메뉴1명',
  '메뉴1가격',
  '메뉴2명',
  '메뉴2가격',
  '메뉴3명',
  '메뉴3가격',
]

function downloadGuidelineTemplate() {
  const example = ['친절하고 자연스러운 톤으로 작성', '근처에 관광지가 있어요', '아메리카노', '4500', '라떼', '5000', '크로플', '6000']
  const csv = '﻿' + GUIDELINE_TEMPLATE_HEADERS.join(',') + '\n' + example.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '캠페인_원고_양식.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function daysBetween(start, end) {
  if (!start || !end) return null
  const days = Math.round((new Date(end) - new Date(start)) / 86400000) + 1
  return days > 0 ? days : null
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

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
  required_count: 1,
  unit_price: 0,
  sale_price: '',
  daily_limit: '',
  start_date: '',
  end_date: '',
  work_days: ALL_DAYS,
  guideline: DEFAULT_GUIDELINE,
  regional_features: '',
  menu_items: [{ ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }],
  photos_per_review: 1,
}

function menuItemsFromStore(store) {
  const items = parseProductString(store?.representative_product)
  if (items.length === 0) return null
  return [0, 1, 2].map((i) =>
    items[i] ? { name: items[i].name.slice(0, MAX_PRODUCT_NAME_LENGTH), price: items[i].price } : { ...EMPTY_MENU_ITEM },
  )
}

export default function TargetForm() {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [targets, setTargets] = useState([])
  const [stores, setStores] = useState([])
  const [photoFiles, setPhotoFiles] = useState([])
  const [guidelineImporting, setGuidelineImporting] = useState(false)
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const guidelineFileInputRef = useRef(null)

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

  async function handleGuidelineFileSelected(e) {
    const file = e.target.files[0]
    if (!file) return
    setGuidelineImporting(true)
    try {
      const parsed = await api.parseTargetGuideline(file)
      setForm((prev) => ({
        ...prev,
        guideline: parsed.guideline || prev.guideline,
        regional_features: parsed.regional_features || prev.regional_features,
        menu_items:
          parsed.menu_items && parsed.menu_items.length > 0
            ? [0, 1, 2].map((i) => parsed.menu_items[i] || { ...EMPTY_MENU_ITEM })
            : prev.menu_items,
      }))
    } catch (err) {
      alert(err.message)
    } finally {
      setGuidelineImporting(false)
      e.target.value = ''
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
    setSubmitting(true)
    setError(null)
    try {
      const menuItems = form.menu_items
        .filter((item) => item.name.trim() && item.price !== '')
        .map((item) => ({ name: item.name.trim(), price: Number(item.price) }))
      const target = await api.createTarget({
        store_id: Number(form.store_id),
        required_count: Number(form.required_count),
        unit_price: Number(form.unit_price),
        sale_price: form.sale_price === '' ? null : Number(form.sale_price),
        work_days: form.work_days,
        daily_limit: form.daily_limit === '' ? null : Number(form.daily_limit),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        guideline: form.guideline.trim() || null,
        regional_features: form.regional_features.trim() || null,
        menu_items: menuItems.length > 0 ? menuItems : null,
        photos_per_review: Number(form.photos_per_review) || 1,
      })
      if (photoFiles.length > 0) {
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
      setPhotoFiles([])
      setRegisterModalOpen(false)
      await refreshTargets()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const dayCount = daysBetween(form.start_date, form.end_date)
  const selectedStore = stores.find((s) => s.id === Number(form.store_id))

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
                  <label className="block text-xs text-slate-500">건수</label>
                  <input
                    type="number"
                    min="1"
                    value={form.required_count}
                    onChange={(e) => setForm({ ...form, required_count: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-500">건당 단가 (원, 리뷰어 정산)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500">
                  건당 판매금액 (원, 매장 청구 — 선택, 정산요약의 매출 집계에 사용)
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.sale_price}
                  onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                  placeholder="비워두면 매출 집계에서 제외됩니다"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">
                  1일 작업 갯수 (선택 — 하루에 이만큼만 오픈풀에서 클레임 가능)
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.daily_limit}
                  onChange={(e) => setForm({ ...form, daily_limit: e.target.value })}
                  placeholder="비워두면 제한 없음"
                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">
                  작업 기간 (선택 — 비워두면 시작일 즉시부터 무기한)
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
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-500">
                    리뷰 원고 자료 (리뷰어가 포털에서 "리뷰 자료 보기"로 확인)
                  </p>
                  <div className="flex items-center gap-1">
                    <input
                      ref={guidelineFileInputRef}
                      type="file"
                      accept=".xlsx,.csv"
                      onChange={handleGuidelineFileSelected}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => guidelineFileInputRef.current?.click()}
                      disabled={guidelineImporting}
                      className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Upload size={12} />
                      {guidelineImporting ? '불러오는 중...' : '엑셀로 원고 불러오기'}
                    </button>
                    <button
                      type="button"
                      onClick={downloadGuidelineTemplate}
                      className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      <Download size={12} />
                      샘플 양식
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500">
                    원고 가이드라인 (AI가 리뷰 원고를 만들 때 참고하는 예시 — 자유롭게 고쳐서 쓰세요)
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
                  <label className="block text-xs text-slate-500">참고 이미지 (선택, 여러 장 가능)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      setPhotoFiles((prev) => [...prev, ...Array.from(e.target.files || [])])
                    }
                    className="w-full text-sm"
                  />
                  {photoFiles.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {photoFiles.map((f, i) => (
                        <span
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
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
                    min="0"
                    value={form.photos_per_review}
                    onChange={(e) => setForm((prev) => ({ ...prev, photos_per_review: e.target.value }))}
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-400">설정한 갯수대로 리뷰1개에 적용됩니다.</p>
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

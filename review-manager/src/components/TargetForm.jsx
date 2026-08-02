import { ChevronDown, ChevronRight, Download, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { enforceProductNameLength, WEEKDAY_LABELS } from '../lib/format.js'
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
  guideline: '',
  regional_features: '',
  menu_items: [{ ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }, { ...EMPTY_MENU_ITEM }],
}

export default function TargetForm() {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [targets, setTargets] = useState([])
  const [stores, setStores] = useState([])
  const [photoFile, setPhotoFile] = useState(null)
  const [guidelineImporting, setGuidelineImporting] = useState(false)
  const [formOpen, setFormOpen] = useState(true)
  const guidelineFileInputRef = useRef(null)

  async function refreshTargets() {
    setTargets(await api.getTargets())
  }

  async function refreshStores(platform) {
    const list = await api.getStores(platform)
    setStores(list)
    setForm((prev) => ({ ...prev, store_id: list[0]?.id ?? '' }))
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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.store_id) {
      setError('먼저 "매장 관리" 탭에서 매장을 등록해주세요.')
      return
    }
    if (form.work_days.length === 0) {
      setError('작업요일을 최소 하루 이상 선택해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    setMessage(null)
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
      })
      if (photoFile) {
        await api.uploadTargetPhoto(target.id, photoFile)
      }
      setMessage(
        `"${target.store_name}" 등록 완료 — ${target.required_count}건이 오픈풀에 등록되었습니다. 리뷰어가 직접 클레임합니다.`,
      )
      setForm((prev) => ({
        ...EMPTY,
        platform: prev.platform,
        store_id: prev.store_id,
      }))
      setPhotoFile(null)
      await refreshTargets()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const dayCount = daysBetween(form.start_date, form.end_date)

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setFormOpen((prev) => !prev)}
        className="flex items-center gap-1 text-base font-semibold text-slate-800"
      >
        {formOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        캠페인 등록
      </button>
      {formOpen && (
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-xl flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
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
            onChange={(e) => setForm({ ...form, store_id: e.target.value })}
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
            <label className="block text-xs text-slate-500">원고 가이드라인</label>
            <textarea
              value={form.guideline}
              onChange={(e) => setForm({ ...form, guideline: e.target.value })}
              rows={3}
              placeholder="리뷰 작성 시 포함해야 할 내용, 톤앤매너 등"
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
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
              메뉴 3개 (영수증 이미지 생성에도 사용됩니다)
            </label>
            <div className="space-y-1">
              {form.menu_items.map((item, i) => (
                <div key={i} className="flex gap-1">
                  <input
                    value={item.name}
                    onChange={(e) => updateMenuItem(i, 'name', enforceProductNameLength(e.target.value))}
                    placeholder={`메뉴명 ${i + 1} (최대 12자)`}
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
            <label className="block text-xs text-slate-500">참고 이미지 (선택)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files[0] || null)}
              className="w-full text-sm"
            />
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
          매장 목록에 없다면 먼저 "매장 관리" 탭에서 등록해주세요. 등록된 작업은 자동
          배정되지 않고 오픈풀에 공개되며, 리뷰어가 셀프서비스 포털의 "가능한 작업 (오픈풀)"
          목록에서 직접 "할게요"를 눌러 클레임합니다. 작업 제한시간(리뷰어가 클레임 후 결과
          링크를 제출해야 하는 시간)은 "설정" 탭에서 관리합니다.
        </p>
        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      )}

      <TargetList targets={targets} onDelete={handleDelete} onUpdated={refreshTargets} />
    </div>
  )
}

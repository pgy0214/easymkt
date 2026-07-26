import { useState } from 'react'
import { api } from '../lib/api.js'
import { WEEKDAY_LABELS } from '../lib/format.js'

const EMPTY_MENU_ITEM = { name: '', price: '' }

function toMenuItemForm(menuItems) {
  const items = menuItems || []
  return [0, 1, 2].map((i) => {
    const item = items[i]
    return item ? { name: item.name, price: String(item.price) } : { ...EMPTY_MENU_ITEM }
  })
}

export default function TargetEditModal({ target, onClose, onSaved }) {
  const [unitPrice, setUnitPrice] = useState(target.unit_price)
  const [salePrice, setSalePrice] = useState(target.sale_price ?? '')
  const [dailyLimit, setDailyLimit] = useState(target.daily_limit ?? '')
  const [startDate, setStartDate] = useState(target.start_date || '')
  const [endDate, setEndDate] = useState(target.end_date || '')
  const [workDays, setWorkDays] = useState(target.work_days && target.work_days.length > 0 ? target.work_days : [0, 1, 2, 3, 4, 5, 6])
  const [guideline, setGuideline] = useState(target.guideline || '')
  const [regionalFeatures, setRegionalFeatures] = useState(target.regional_features || '')
  const [menuItems, setMenuItems] = useState(toMenuItemForm(target.menu_items))
  const [photoFile, setPhotoFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function toggleWorkDay(day) {
    setWorkDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  function updateMenuItem(index, field, value) {
    setMenuItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  async function handleSave() {
    if (workDays.length === 0) {
      setError('작업요일을 최소 하루 이상 선택해주세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const cleanMenuItems = menuItems
        .filter((item) => item.name.trim() && item.price !== '')
        .map((item) => ({ name: item.name.trim(), price: Number(item.price) }))
      const updated = await api.updateTarget(target.id, {
        unit_price: Number(unitPrice),
        sale_price: salePrice === '' ? null : Number(salePrice),
        daily_limit: dailyLimit === '' ? null : Number(dailyLimit),
        start_date: startDate || null,
        end_date: endDate || null,
        work_days: workDays,
        guideline: guideline.trim() || null,
        regional_features: regionalFeatures.trim() || null,
        menu_items: cleanMenuItems.length > 0 ? cleanMenuItems : null,
      })
      if (photoFile) {
        await api.uploadTargetPhoto(target.id, photoFile)
      }
      onSaved(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-slate-800">{target.store_name} 캠페인 수정</h3>

        <div className="rounded border border-slate-100 bg-slate-50 p-2 text-xs text-slate-500">
          플랫폼·매장·건수는 이미 생성된 작업과 직결돼 있어 여기서 고칠 수 없어요. 잘못
          등록했으면 삭제 후 재등록해주세요.
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500">건당 단가 (원, 리뷰어 정산)</label>
            <input
              type="number"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500">건당 판매금액 (원, 선택)</label>
            <input
              type="number"
              min="0"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="비워두면 매출 집계에서 제외"
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500">1일 작업 갯수 (선택)</label>
          <input
            type="number"
            min="1"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            placeholder="비워두면 제한 없음"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-500">작업 기간 (선택)</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <span className="text-xs text-slate-400">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500">작업요일</label>
          <div className="mt-1 flex gap-1">
            {WEEKDAY_LABELS.map((label, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleWorkDay(day)}
                className={`h-7 w-7 rounded text-xs font-medium ${
                  workDays.includes(day) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500">리뷰 원고 자료</p>
          <div>
            <label className="block text-xs text-slate-500">원고 가이드라인</label>
            <textarea
              value={guideline}
              onChange={(e) => setGuideline(e.target.value)}
              rows={3}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">지역적 특징</label>
            <textarea
              value={regionalFeatures}
              onChange={(e) => setRegionalFeatures(e.target.value)}
              rows={2}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">메뉴 3개</label>
            <div className="space-y-1">
              {menuItems.map((item, i) => (
                <div key={i} className="flex gap-1">
                  <input
                    value={item.name}
                    onChange={(e) => updateMenuItem(i, 'name', e.target.value)}
                    placeholder={`메뉴명 ${i + 1}`}
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
            <label className="block text-xs text-slate-500">참고 이미지 (선택 — 다시 올리면 기존 이미지를 대체)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files[0] || null)}
              className="w-full text-sm"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { X } from 'lucide-react'
import { useState } from 'react'
import { API_ORIGIN, api } from '../lib/api.js'
import { enforceProductNameLength, WEEKDAY_LABELS } from '../lib/format.js'

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
  const [photoFiles, setPhotoFiles] = useState([])
  const [photosPerReview, setPhotosPerReview] = useState(target.photos_per_review ?? 1)
  const [photos, setPhotos] = useState(target.photos || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleDeletePhoto(photoId) {
    try {
      await api.deleteTargetPhoto(target.id, photoId)
      setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    } catch (err) {
      alert(err.message)
    }
  }

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
        photos_per_review: Number(photosPerReview) || 1,
      })
      let updatedPhotos = photos
      if (photoFiles.length > 0) {
        const uploaded = await api.uploadTargetPhotos(target.id, photoFiles)
        updatedPhotos = [...photos, ...uploaded]
        setPhotos(updatedPhotos)
        setPhotoFiles([])
      }
      onSaved({ ...updated, photos: updatedPhotos })
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
            <label className="block text-xs text-slate-500">사진 풀 (여러 장 추가 가능)</label>
            {photos.length > 0 && (
              <div className="mt-1 grid grid-cols-6 gap-1">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative">
                    <img
                      src={`${API_ORIGIN}${photo.file_path}`}
                      alt="캠페인 사진"
                      className="aspect-square rounded border border-slate-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"
                      title="삭제"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) =>
                setPhotoFiles((prev) => [...prev, ...Array.from(e.target.files || [])])
              }
              className="mt-1 w-full text-sm"
            />
            {photoFiles.length > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                저장하면 {photoFiles.length}장이 자동 세탁되어 추가됩니다.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500">리뷰당 사진 갯수</label>
            <input
              type="number"
              min="0"
              value={photosPerReview}
              onChange={(e) => setPhotosPerReview(e.target.value)}
              className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">설정한 갯수대로 리뷰1개에 적용됩니다.</p>
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

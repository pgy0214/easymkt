import { X } from 'lucide-react'
import { useState } from 'react'
import { API_ORIGIN, api } from '../lib/api.js'
import { enforceProductNameLength, WEEKDAY_LABELS } from '../lib/format.js'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'

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
    <Modal open onClose={onClose} size="xl">
      <h3 className="font-semibold text-gray-800">{target.store_name} 캠페인 수정</h3>

      <div className="rounded-card border border-gray-100 bg-gray-50 p-2 text-xs text-gray-500">
        플랫폼·매장·건수는 이미 생성된 작업과 직결돼 있어 여기서 고칠 수 없어요. 잘못
        등록했으면 삭제 후 재등록해주세요.
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            label="리뷰어 단가 (원)"
            type="number"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <Input
            label="판매단가 (원, 선택)"
            type="number"
            min="0"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="비워두면 매출 집계에서 제외"
          />
        </div>
      </div>

      <Input
        label="1일 작업 갯수 (선택)"
        type="number"
        min="1"
        value={dailyLimit}
        onChange={(e) => setDailyLimit(e.target.value)}
        placeholder="비워두면 제한 없음"
      />

      <div>
        <label className="block text-xs text-gray-500">작업 기간 (선택)</label>
        <div className="mt-1 flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-xs text-gray-400">~</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500">작업요일</label>
        <div className="mt-1 flex gap-1">
          {WEEKDAY_LABELS.map((label, day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleWorkDay(day)}
              className={`h-7 w-7 rounded-btn text-xs font-medium ${
                workDays.includes(day) ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-500">리뷰 원고 자료</p>
        <div>
          <label className="block text-xs text-gray-500">원고 가이드라인</label>
          <textarea
            value={guideline}
            onChange={(e) => setGuideline(e.target.value)}
            rows={3}
            className="w-full rounded-btn border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">지역적 특징</label>
          <textarea
            value={regionalFeatures}
            onChange={(e) => setRegionalFeatures(e.target.value)}
            rows={2}
            className="w-full rounded-btn border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500">메뉴 3개</label>
          <div className="space-y-1">
            {menuItems.map((item, i) => (
              <div key={i} className="flex gap-1">
                <Input
                  value={item.name}
                  onChange={(e) => updateMenuItem(i, 'name', enforceProductNameLength(e.target.value))}
                  placeholder={`메뉴명 ${i + 1} (최대 12자)`}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  value={item.price}
                  onChange={(e) => updateMenuItem(i, 'price', e.target.value)}
                  placeholder="가격"
                  className="w-28"
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500">사진 풀 (여러 장 추가 가능)</label>
          {photos.length > 0 && (
            <div className="mt-1 grid grid-cols-6 gap-1">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative">
                  <img
                    src={`${API_ORIGIN}${photo.file_path}`}
                    alt="캠페인 사진"
                    className="aspect-square rounded-btn border border-gray-200 object-cover"
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
            <p className="mt-1 text-xs text-gray-400">
              저장하면 {photoFiles.length}장이 자동 세탁되어 추가됩니다.
            </p>
          )}
        </div>
        <Input
          label="리뷰당 사진 갯수"
          type="number"
          min="0"
          value={photosPerReview}
          onChange={(e) => setPhotosPerReview(e.target.value)}
          className="w-20"
        />
      </div>

      {error && <p className="text-xs text-danger-text">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </Modal>
  )
}

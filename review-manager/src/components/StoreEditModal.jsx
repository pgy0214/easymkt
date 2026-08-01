import { useState } from 'react'
import { api } from '../lib/api.js'
import { formatBusinessNumber, formatDateTime } from '../lib/format.js'
import ProductRowsEditor from './ProductRowsEditor.jsx'

export default function StoreEditModal({ store, onClose, onSaved }) {
  const [url, setUrl] = useState(store.url)
  const [representativeProduct, setRepresentativeProduct] = useState(
    store.representative_product || '',
  )
  const [cooldownDays, setCooldownDays] = useState(store.cooldown_days)
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState(
    store.business_registration_number || '',
  )
  const [representativeName, setRepresentativeName] = useState(store.representative_name || '')
  const [phone, setPhone] = useState(store.phone || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await api.updateStore(store.id, {
        url: url.trim(),
        representative_product: representativeProduct.trim() || null,
        cooldown_days: Number(cooldownDays),
        business_registration_number: businessRegistrationNumber.trim() || null,
        representative_name: representativeName.trim() || null,
        phone: phone.trim() || null,
      })
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
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-slate-800">{store.name} 수정</h3>

        <div className="space-y-1 rounded border border-slate-100 bg-slate-50 p-2 text-xs text-slate-500">
          <p>매장명·주소·대표시간은 크롤링한 사실 정보라 여기서 고칠 수 없어요.</p>
          <p>
            {store.address || '주소 없음'}
            {store.representative_hours ? ` · ${store.representative_hours}` : ''}
          </p>
        </div>

        <div>
          <label className="block text-xs text-slate-500">매장 URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">재작업 가능 주기 (일)</label>
          <input
            type="number"
            min="1"
            value={cooldownDays}
            onChange={(e) => setCooldownDays(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">대표상품</label>
          <ProductRowsEditor value={representativeProduct} onChange={setRepresentativeProduct} />
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">영수증 생성에 쓰이는 사업자 정보 (선택)</p>
          <input
            value={businessRegistrationNumber}
            onChange={(e) => setBusinessRegistrationNumber(formatBusinessNumber(e.target.value))}
            placeholder="사업자번호 (예: 250-07-00453)"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            value={representativeName}
            onChange={(e) => setRepresentativeName(e.target.value)}
            placeholder="대표자명"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="전화번호 (예: 0507-1412-5171)"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
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

        <p className="border-t border-slate-100 pt-2 text-xs text-slate-400">
          마지막 수정: {store.updated_at ? formatDateTime(store.updated_at) : '수정 이력 없음'}
        </p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { api } from '../lib/api.js'
import { formatBusinessNumber, formatDateTime } from '../lib/format.js'
import ProductRowsEditor from './ProductRowsEditor.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'

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
    <Modal open onClose={onClose} size="md">
      <h3 className="font-semibold text-gray-800">{store.name} 수정</h3>

      <div className="space-y-1 rounded-card border border-gray-100 bg-gray-50 p-2 text-xs text-gray-500">
        <p>매장명·주소·대표시간은 크롤링한 사실 정보라 여기서 고칠 수 없어요.</p>
        <p>
          {store.address || '주소 없음'}
          {store.representative_hours ? ` · ${store.representative_hours}` : ''}
        </p>
      </div>

      <Input
        label="매장 URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Input
        label="재작업 가능 주기 (일)"
        type="number"
        min="1"
        value={cooldownDays}
        onChange={(e) => setCooldownDays(e.target.value)}
      />
      <div>
        <label className="block text-xs text-gray-500">대표상품</label>
        <ProductRowsEditor value={representativeProduct} onChange={setRepresentativeProduct} />
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500">영수증 생성에 쓰이는 사업자 정보 (선택)</p>
        <Input
          value={businessRegistrationNumber}
          onChange={(e) => setBusinessRegistrationNumber(formatBusinessNumber(e.target.value))}
          placeholder="사업자번호 (예: 250-07-00453)"
        />
        <Input
          value={representativeName}
          onChange={(e) => setRepresentativeName(e.target.value)}
          placeholder="대표자명"
        />
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="전화번호 (예: 0507-1412-5171)"
        />
      </div>

      {error && <p className="text-xs text-danger-text">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>

      <p className="border-t border-gray-100 pt-2 text-xs text-gray-400">
        마지막 수정: {store.updated_at ? formatDateTime(store.updated_at) : '수정 이력 없음'}
      </p>
    </Modal>
  )
}

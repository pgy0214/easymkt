import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { MAX_PRODUCT_NAME_LENGTH, enforceProductNameLength, parseProductString } from '../lib/format.js'
import Input from './ui/Input.jsx'

// "대표상품" 문자열("아메리카노 4,500원, 카페라떼 5000원")을 행 배열로 파싱/직렬화한다.
// 저장 형식은 그대로 콤마구분 문자열로 유지 — 백엔드 필드(Store.representative_product)가
// 단순 텍스트라 구조화 마이그레이션 없이도 UI만 행 단위로 바꿀 수 있다.
function parseProductRows(text) {
  const items = parseProductString(text)
  return items.length > 0 ? items : [{ name: '', price: '' }]
}

function serializeProductRows(rows) {
  return rows
    .filter((row) => row.name.trim())
    .map((row) => (row.price.toString().trim() ? `${row.name.trim()} ${row.price.toString().trim()}원` : row.name.trim()))
    .join(', ')
}

export default function ProductRowsEditor({ value, onChange }) {
  const [rows, setRows] = useState(() => parseProductRows(value))

  function update(index, field, val) {
    const next = rows.map((row, i) => (i === index ? { ...row, [field]: val } : row))
    setRows(next)
    onChange(serializeProductRows(next))
  }

  function addRow() {
    setRows((prev) => [...prev, { name: '', price: '' }])
  }

  function removeRow(index) {
    const next = rows.filter((_, i) => i !== index)
    const finalRows = next.length > 0 ? next : [{ name: '', price: '' }]
    setRows(finalRows)
    onChange(serializeProductRows(finalRows))
  }

  return (
    <div className="space-y-1">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1">
          <Input
            value={row.name}
            onChange={(e) => update(i, 'name', enforceProductNameLength(e.target.value))}
            placeholder={`메뉴명 ${i + 1} (최대 ${MAX_PRODUCT_NAME_LENGTH}자)`}
            className="flex-1"
          />
          <Input
            value={row.price}
            onChange={(e) => update(i, 'price', e.target.value.replace(/[^\d]/g, ''))}
            placeholder="금액"
            inputMode="numeric"
            className="w-24"
          />
          <span className="text-xs text-gray-400">원</span>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="text-gray-400 hover:text-danger-text"
            title="행 삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
      >
        <Plus size={12} />
        상품 추가
      </button>
    </div>
  )
}

import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

// "대표상품" 문자열("아메리카노 4,500원, 카페라떼 5000원")을 행 배열로 파싱/직렬화한다.
// 저장 형식은 그대로 콤마구분 문자열로 유지 — 백엔드 필드(Store.representative_product)가
// 단순 텍스트라 구조화 마이그레이션 없이도 UI만 행 단위로 바꿀 수 있다.
function parseProductRows(text) {
  if (!text) return [{ name: '', price: '' }]
  const rows = text
    .split(',')
    .map((segment) => {
      const trimmed = segment.trim()
      const match = trimmed.match(/^(.*?)\s+([\d,]+)\s*원?$/)
      if (match) return { name: match[1].trim(), price: match[2].replace(/,/g, '') }
      return { name: trimmed, price: '' }
    })
    .filter((row) => row.name)
  return rows.length > 0 ? rows : [{ name: '', price: '' }]
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
          <input
            value={row.name}
            onChange={(e) => update(i, 'name', e.target.value)}
            placeholder={`메뉴명 ${i + 1}`}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            value={row.price}
            onChange={(e) => update(i, 'price', e.target.value.replace(/[^\d]/g, ''))}
            placeholder="금액"
            inputMode="numeric"
            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <span className="text-xs text-slate-400">원</span>
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="text-slate-400 hover:text-red-600"
            title="행 삭제"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
      >
        <Plus size={12} />
        상품 추가
      </button>
    </div>
  )
}

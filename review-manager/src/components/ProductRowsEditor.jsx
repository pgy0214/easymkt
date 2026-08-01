import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

// 상품명 칸 x=50 ~ 단가 칸(우측정렬, x=390) 사이 실측 여유폭을 PIL로 직접 재서 정한
// 값 — review-manager-backend/app/receipt_generator.py의 MAX_PRODUCT_NAME_LENGTH와
// 반드시 같은 값을 유지해야 한다(영수증 캔버스에서 상품명이 단가 칸과 겹치는 걸 실제로
// 확인했음).
const MAX_PRODUCT_NAME_LENGTH = 12

// "대표상품" 문자열("아메리카노 4,500원, 카페라떼 5000원")을 행 배열로 파싱/직렬화한다.
// 저장 형식은 그대로 콤마구분 문자열로 유지 — 백엔드 필드(Store.representative_product)가
// 단순 텍스트라 구조화 마이그레이션 없이도 UI만 행 단위로 바꿀 수 있다.
//
// 단순히 ","로 나누면 "22,000원"처럼 가격 자체에 천단위 콤마가 들어간 경우 "22"와
// "000원"으로 쪼개져버리는 문제가 있었다(실제로 이렇게 깨진 화면을 확인함). 그래서
// 문자열 전체에서 "이름 + 공백 + 숫자(,숫자)* + 선택적 원 + (,로 이어지거나 끝)" 패턴을
// 직접 찾는다 — 백엔드 receipt_generator.parse_representative_product와 동일한 로직.
const PRODUCT_ITEM_RE = /(.+?)\s+(\d+(?:,\d{3})*)\s*원?\s*(?:,\s*|$)/g

function parseProductRows(text) {
  if (!text) return [{ name: '', price: '' }]
  const rows = []
  for (const match of text.trim().matchAll(PRODUCT_ITEM_RE)) {
    const name = match[1].trim()
    if (name) rows.push({ name, price: match[2].replace(/,/g, '') })
  }
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
            placeholder={`메뉴명 ${i + 1} (최대 ${MAX_PRODUCT_NAME_LENGTH}자)`}
            maxLength={MAX_PRODUCT_NAME_LENGTH}
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

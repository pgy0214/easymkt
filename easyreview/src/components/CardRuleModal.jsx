import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'

const EMPTY = { card_prefix_1: '', card_prefix_2: '', approval_prefix: '', acquirer: '', card_type: '' }

const TEMPLATE_HEADERS = ['카드번호 앞 4자리', '카드번호 다음 4자리', '승인번호 앞자리', '매입사명', '카드종류']

function downloadTemplate() {
  // leading BOM so Excel opens the Korean headers as UTF-8 instead of guessing ANSI.
  const csv = '﻿' + TEMPLATE_HEADERS.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '영수증카드정보_일괄등록_양식.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CardRuleModal({ onClose }) {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const fileInputRef = useRef(null)

  async function refresh() {
    setLoading(true)
    try {
      setRules(await api.getCardRules())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    const { card_prefix_1, card_prefix_2, approval_prefix, acquirer, card_type } = form
    if (!card_prefix_1.trim() || !card_prefix_2.trim() || !approval_prefix.trim() || !acquirer.trim() || !card_type.trim()) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await api.createCardRule({
        card_prefix_1: card_prefix_1.trim(),
        card_prefix_2: card_prefix_2.trim(),
        approval_prefix: approval_prefix.trim(),
        acquirer: acquirer.trim(),
        card_type: card_type.trim(),
      })
      setRules((prev) => [...prev, created])
      setForm(EMPTY)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    try {
      const result = await api.importCardRules(file)
      setImportResult(result)
      await refresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleDelete(id) {
    if (!confirm('이 카드정보를 삭제할까요?')) return
    try {
      await api.deleteCardRule(id)
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <Modal open onClose={onClose} size="2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">영수증 카드정보 관리</h3>
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
            닫기
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          영수증 이미지를 만들 때 이 목록에서 하나를 무작위로 골라 카드번호/승인번호/매입사명/카드종류를
          채웁니다. 승인번호는 입력한 앞자리 뒤에 8자리가 되도록 랜덤 숫자를 붙입니다 (예: "8" → 8로
          시작하는 8자리 숫자).
        </p>

        <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-2 rounded-card border border-gray-200 bg-gray-50 p-3">
          <Input
            label="카드번호 앞 4자리"
            value={form.card_prefix_1}
            onChange={(e) => setForm({ ...form, card_prefix_1: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            placeholder="4678"
            className="w-24"
          />
          <Input
            label="카드번호 다음 4자리"
            value={form.card_prefix_2}
            onChange={(e) => setForm({ ...form, card_prefix_2: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            placeholder="5600"
            className="w-24"
          />
          <Input
            label="승인번호 앞자리"
            value={form.approval_prefix}
            onChange={(e) => setForm({ ...form, approval_prefix: e.target.value.replace(/\D/g, '').slice(0, 7) })}
            placeholder="8"
            className="w-20"
          />
          <Input
            label="매입사명"
            value={form.acquirer}
            onChange={(e) => setForm({ ...form, acquirer: e.target.value })}
            placeholder="우리"
            className="w-24"
          />
          <Input
            label="카드종류"
            value={form.card_type}
            onChange={(e) => setForm({ ...form, card_type: e.target.value })}
            placeholder="우리카드"
            className="w-28"
          />
          <Button type="submit" disabled={submitting}>
            <Plus size={14} />
            추가
          </Button>
        </form>
        {error && <p className="mb-2 text-xs text-danger-text">{error}</p>}

        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-card border border-dashed border-gray-300 bg-white p-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileSelected}
            className="hidden"
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload size={14} />
            {importing ? '업로드 중...' : '엑셀/CSV로 일괄 등록'}
          </Button>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download size={14} />
            샘플 양식 다운로드
          </Button>
          <span className="text-xs text-gray-400">
            카드번호 앞/다음 4자리, 승인번호 앞자리, 매입사명, 카드종류 컬럼이 있는 .xlsx 또는
            .csv 파일
          </span>
          {importResult && (
            <span className="ml-auto text-xs text-gray-600">
              신규 {importResult.created}건 · 중복건너뜀 {importResult.skipped_duplicate}건 ·
              형식오류 {importResult.skipped_invalid}건
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-gray-200">
            <table className="w-full min-w-[500px] text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-2 py-1.5">카드번호</th>
                  <th className="px-2 py-1.5">승인번호 앞자리</th>
                  <th className="px-2 py-1.5">매입사명</th>
                  <th className="px-2 py-1.5">카드종류</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5 text-gray-600">
                      {r.card_prefix_1}-{r.card_prefix_2}-****-****
                    </td>
                    <td className="px-2 py-1.5 text-gray-600">{r.approval_prefix}</td>
                    <td className="px-2 py-1.5">{r.acquirer}</td>
                    <td className="px-2 py-1.5">{r.card_type}</td>
                    <td className="px-2 py-1.5">
                      <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-danger-text" title="삭제">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rules.length === 0 && <p className="p-3 text-sm text-gray-400">등록된 카드정보가 없습니다</p>}
          </div>
        )}
    </Modal>
  )
}

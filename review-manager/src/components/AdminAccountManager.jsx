import { Download, ExternalLink, Pencil, Plus, Search, Send, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import AccountEditModal from './AccountEditModal.jsx'
import AccountTaskModal from './AccountTaskModal.jsx'
import BulkAssignModal from './BulkAssignModal.jsx'
import CopyButton from './CopyButton.jsx'
import Pagination from './Pagination.jsx'

const GENDER_BADGE = {
  male: 'bg-sky-100 text-sky-700',
  female: 'bg-rose-100 text-rose-700',
}

const GENDER_SHORT = {
  male: '남',
  female: '여',
}

// 화면 표시 전용 압축 형식(YYMMDD, 예: 1957-07-10 → "570710") — 일괄등록 시에도
// 같은 형식으로 입력받는다(app/importers.py의 _parse_birth_date와 짝).
function formatBirthDateCompact(value) {
  if (!value) return '-'
  const [y, m, d] = value.split('-')
  return `${y.slice(-2)}${m}${d}`
}

const EMPTY = {
  platform: 'naver',
  name: '',
  gender: '',
  birth_date: '',
  contact_info: '',
  label: '',
  password: '',
  profile_url: '',
  ip_address: '',
}

const TEMPLATE_HEADERS = ['플랫폼', 'IP', '이름', '성별', '생년월일(예:570710)', '연락처', '계정아이디', '비밀번호', '네이버마이플레이스URL']

function downloadTemplate() {
  // leading BOM so Excel opens the Korean headers as UTF-8 instead of guessing ANSI.
  // 예시 데이터 행은 넣지 않는다 — 지우지 않고 그대로 업로드하면 가짜 계정이 등록되기 때문
  const csv = '﻿' + TEMPLATE_HEADERS.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '관리자계정_일괄등록_양식.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminAccountManager() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [editingRow, setEditingRow] = useState(null)
  const [taskRow, setTaskRow] = useState(null)
  const [stores, setStores] = useState([])
  const [storeFilter, setStoreFilter] = useState('')
  const [ineligibleForStore, setIneligibleForStore] = useState(new Set())
  const [checkingEligibility, setCheckingEligibility] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState(new Set())
  const [bulkAssigning, setBulkAssigning] = useState(false)
  const fileInputRef = useRef(null)

  function rowKey(row) {
    return `${row.reviewerId}-${row.id ?? 'none'}`
  }

  function toggleSelected(key) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toRows(reviewers) {
    return reviewers.flatMap((r) =>
      r.accounts.length > 0
        ? r.accounts.map((a) => ({
            ...a,
            reviewerId: r.id,
            name: r.name,
            gender: r.gender,
            birth_date: r.birth_date,
            contact_info: r.contact_info,
          }))
        : [
            {
              id: null,
              reviewerId: r.id,
              name: r.name,
              gender: r.gender,
              birth_date: r.birth_date,
              contact_info: r.contact_info,
              platform: null,
              profile_url: null,
              ip_address: null,
              password: null,
              has_login_issue: false,
            },
          ],
    )
  }

  async function refresh() {
    setLoading(true)
    try {
      const all = await api.getReviewers()
      setRows(toRows(all.filter((r) => r.category === 'admin')))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    api.getStores().then(setStores).catch(() => {})
  }, [])

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === Number(storeFilter)) ?? null,
    [stores, storeFilter],
  )

  useEffect(() => {
    if (!selectedStore) {
      setIneligibleForStore(new Set())
      return
    }
    let cancelled = false
    const candidates = rows.filter((r) => r.id != null && r.platform === selectedStore.platform)
    setCheckingEligibility(true)
    Promise.all(candidates.map((r) => api.getAccountStoreHistory(r.id)))
      .then((results) => {
        if (cancelled) return
        const ineligible = new Set()
        results.forEach((history, i) => {
          const entry = history.find((h) => h.store_id === selectedStore.id)
          if (entry && !entry.is_eligible_now) ineligible.add(candidates[i].id)
        })
        setIneligibleForStore(ineligible)
      })
      .finally(() => {
        if (!cancelled) setCheckingEligibility(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, rows])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.label.trim()) return
    setSubmitting(true)
    try {
      const reviewer = await api.createReviewer({
        category: 'admin',
        name: form.name.trim(),
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        contact_info: form.contact_info.trim() || null,
      })
      const account = await api.createAccount(reviewer.id, {
        platform: form.platform,
        label: form.label.trim(),
        password: form.password.trim() || null,
        profile_url: form.platform === 'naver' ? form.profile_url.trim() || null : null,
        ip_address: form.ip_address.trim() || null,
      })
      setRows((prev) => [
        ...prev,
        {
          ...account,
          reviewerId: reviewer.id,
          name: reviewer.name,
          gender: reviewer.gender,
          birth_date: reviewer.birth_date,
          contact_info: reviewer.contact_info,
        },
      ])
      setForm({ ...EMPTY, platform: form.platform })
    } catch (err) {
      alert(err.message)
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
      const result = await api.importAdminAccounts(file)
      setImportResult(result)
      await refresh()
    } catch (err) {
      alert(err.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  async function handleToggleLoginIssue(row) {
    try {
      const updated = await api.updateAccount(row.id, { has_login_issue: !row.has_login_issue })
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDelete(row) {
    if (!confirm('이 관리자 계정을 삭제할까요?')) return
    try {
      if (row.id != null) {
        await api.deleteAccount(row.id)
      }
      const remaining = rows.filter((r) => r.reviewerId === row.reviewerId && r.id !== row.id)
      if (remaining.length === 0) {
        await api.deleteReviewer(row.reviewerId)
      }
      setRows((prev) => prev.filter((r) => !(r.reviewerId === row.reviewerId && r.id === row.id)))
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        next.delete(rowKey(row))
        return next
      })
    } catch (err) {
      alert(err.message)
    }
  }

  function handleEdited(updated) {
    setRows((prev) => prev.map((r) => (r.id === editingRow.id ? { ...r, ...updated } : r)))
    setEditingRow(null)
  }

  const selectedRows = useMemo(() => rows.filter((r) => selectedKeys.has(rowKey(r))), [rows, selectedKeys])

  async function handleBulkDelete() {
    if (!confirm(`선택한 ${selectedRows.length}개 계정을 삭제할까요?`)) return
    const toDelete = selectedRows.filter((r) => r.id != null)
    try {
      for (const row of toDelete) {
        await api.deleteAccount(row.id)
      }
      const deletedIds = new Set(toDelete.map((r) => r.id))
      const remaining = rows.filter((r) => !deletedIds.has(r.id))
      const affectedReviewerIds = new Set(toDelete.map((r) => r.reviewerId))
      for (const reviewerId of affectedReviewerIds) {
        const stillHasAccount = remaining.some((r) => r.reviewerId === reviewerId && r.id != null)
        if (!stillHasAccount) await api.deleteReviewer(reviewerId)
      }
      setSelectedKeys(new Set())
      await refresh()
    } catch (err) {
      alert(err.message)
      await refresh()
    }
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    let result = rows
    if (query) {
      result = result.filter((row) =>
        [row.name, row.contact_info, row.label, row.ip_address]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(query)),
      )
    }
    if (selectedStore) {
      result = result.filter(
        (row) => row.id != null && row.platform === selectedStore.platform && !ineligibleForStore.has(row.id),
      )
    }
    return result
  }, [rows, search, selectedStore, ineligibleForStore])

  useEffect(() => {
    setPage(1)
  }, [search, storeFilter, pageSize])

  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        여기 등록된 계정은 리뷰어가 아니라 우리(회사)가 직접 소유한 계정입니다. "리뷰어 관리"
        목록에는 나타나지 않습니다.
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="block text-xs text-slate-500">플랫폼</label>
          <select
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="naver">네이버</option>
            <option value="kakao">카카오</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">이름</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">성별</label>
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">선택 안 함</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500">생년월일</label>
          <input
            type="date"
            value={form.birth_date}
            onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">연락처</label>
          <input
            value={form.contact_info}
            onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
            className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">계정 아이디</label>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="계정 닉네임"
            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">계정 비밀번호</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        {form.platform === 'naver' && (
          <div>
            <label className="block text-xs text-slate-500">네이버 마이플레이스 URL</label>
            <input
              value={form.profile_url}
              onChange={(e) => setForm({ ...form, profile_url: e.target.value })}
              placeholder="https://m.place.naver.com/my/..."
              className="w-56 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-500">IP</label>
          <input
            value={form.ip_address}
            onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
            placeholder="예: 123.45.67.89"
            className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={14} />
          관리자 계정 추가
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileSelected}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-1 rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          <Upload size={14} />
          {importing ? '업로드 중...' : '엑셀/CSV로 일괄 등록'}
        </button>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Download size={14} />
          샘플 양식 다운로드
        </button>
        <span className="text-xs text-slate-400">
          플랫폼/IP/이름/성별/생년월일/연락처/계정아이디/비밀번호/URL 컬럼이 있는 .xlsx 또는
          .csv 파일 (이름과 계정아이디가 둘 다 있는 행만 등록됩니다. 생년월일은 570710처럼
          YYMMDD 6자리로 입력)
        </span>
        {importResult && (
          <span className="ml-auto text-xs text-slate-600">
            신규 {importResult.created}건 · 중복건너뜀 {importResult.skipped_duplicate}건 ·
            필수값없음 {importResult.skipped_invalid}건
          </span>
        )}
      </div>

      {loading && <p className="text-sm text-slate-400">불러오는 중...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && rows.length === 0 && (
        <p className="text-sm text-slate-400">등록된 관리자 계정이 없습니다</p>
      )}

      {!loading && rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름/연락처/계정아이디/IP 검색"
                className="w-full rounded border border-slate-300 py-1 pl-7 pr-2 text-sm"
              />
            </div>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">작업 매장으로 필터링 안 함</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.platform === 'naver' ? '네이버' : '카카오'}] {s.name}
                </option>
              ))}
            </select>
            {checkingEligibility && (
              <span className="text-xs text-slate-400">작업가능 여부 확인 중...</span>
            )}
            {selectedStore && !checkingEligibility && (
              <span className="text-xs text-slate-500">
                {selectedStore.name}에서 지금 작업 가능한 계정만 표시 중
              </span>
            )}
            {selectedKeys.size > 0 && (
              <>
                <span className="text-xs text-slate-500">선택 {selectedKeys.size}건</span>
                <button
                  onClick={() => setBulkAssigning(true)}
                  className="flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                >
                  <Send size={12} />
                  선택 작업 배분
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                >
                  <Trash2 size={12} />
                  선택 삭제
                </button>
              </>
            )}
          </div>

          {filteredRows.length === 0 ? (
            <p className="text-sm text-slate-400">조건에 맞는 계정이 없습니다</p>
          ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[1200px] whitespace-nowrap text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={visibleRows.length > 0 && visibleRows.every((r) => selectedKeys.has(rowKey(r)))}
                    onChange={() =>
                      setSelectedKeys((prev) => {
                        const allSelected = visibleRows.every((r) => prev.has(rowKey(r)))
                        const next = new Set(prev)
                        visibleRows.forEach((r) => {
                          if (allSelected) next.delete(rowKey(r))
                          else next.add(rowKey(r))
                        })
                        return next
                      })
                    }
                    title="현재 페이지 전체 선택"
                  />
                </th>
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">플랫폼</th>
                <th className="px-2 py-1.5">IP</th>
                <th className="px-2 py-1.5">이름</th>
                <th className="px-2 py-1.5">성별</th>
                <th className="px-2 py-1.5">생년월일</th>
                <th className="px-2 py-1.5">연락처</th>
                <th className="px-2 py-1.5">계정 아이디</th>
                <th className="px-2 py-1.5">비밀번호</th>
                <th className="px-2 py-1.5">URL</th>
                <th className="px-2 py-1.5">상태</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row, index) => (
                <tr key={rowKey(row)}>
                  <td className="px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(rowKey(row))}
                      onChange={() => toggleSelected(rowKey(row))}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-slate-400">{(page - 1) * pageSize + index + 1}</td>
                  <td className="px-2 py-1.5">
                    {row.platform === 'naver' ? '네이버' : row.platform === 'kakao' ? '카카오' : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">{row.ip_address || '-'}</td>
                  <td className="px-2 py-1.5">{row.name}</td>
                  <td className="px-2 py-1.5">
                    {row.gender ? (
                      <span className={`rounded px-1 py-0.5 text-[11px] font-medium ${GENDER_BADGE[row.gender]}`}>
                        {GENDER_SHORT[row.gender]}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">{formatBirthDateCompact(row.birth_date)}</td>
                  <td className="px-2 py-1.5 text-slate-500">{row.contact_info || '-'}</td>
                  <td className="px-2 py-1.5">
                    <span className="inline-flex items-center gap-1">
                      {row.label || '-'}
                      <CopyButton value={row.label} label="계정 아이디" />
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    {row.password ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-slate-600">{row.password}</span>
                        <CopyButton value={row.password} label="비밀번호" />
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.profile_url ? (
                      <a
                        href={row.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        title={row.profile_url}
                        className="inline-flex items-center justify-center rounded border border-slate-200 p-1 text-blue-600 hover:bg-blue-50"
                      >
                        <ExternalLink size={13} />
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.id != null && (
                      <button
                        onClick={() => handleToggleLoginIssue(row)}
                        className="inline-flex items-center justify-center p-1"
                        title={row.has_login_issue ? '로그인 문제 — 클릭해서 정상으로 표시' : '정상 — 클릭해서 로그인 문제로 표시'}
                      >
                        <span
                          className={`block h-2.5 w-2.5 rounded-full ${
                            row.has_login_issue ? 'bg-red-500' : 'bg-green-500'
                          }`}
                        />
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      {row.id != null && (
                        <>
                          <button
                            onClick={() => setEditingRow(row)}
                            className="text-slate-400 hover:text-blue-600"
                            title="정보 수정"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setTaskRow(row)}
                            className="text-slate-400 hover:text-blue-600"
                            title="작업 관리"
                          >
                            <Send size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(row)}
                        className="text-slate-400 hover:text-red-600"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          )}

          {filteredRows.length > pageSize && (
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={filteredRows.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </>
      )}

      {editingRow && (
        <AccountEditModal row={editingRow} onClose={() => setEditingRow(null)} onSaved={handleEdited} />
      )}
      {taskRow && <AccountTaskModal row={taskRow} onClose={() => setTaskRow(null)} />}
      {bulkAssigning && (
        <BulkAssignModal
          entities={selectedRows.filter((r) => r.id != null)}
          getDisplayName={(row) => `${row.name} (${row.label})`}
          resolveAccount={(row, platform) => (row.platform === platform ? row : null)}
          unitLabel="개 계정"
          onClose={() => setBulkAssigning(false)}
          onDone={refresh}
        />
      )}
    </div>
  )
}

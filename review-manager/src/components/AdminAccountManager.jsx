import { AlertTriangle, Download, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import CopyButton from './CopyButton.jsx'
import Pagination from './Pagination.jsx'

const EMPTY = {
  platform: 'naver',
  name: '',
  contact_info: '',
  label: '',
  password: '',
  profile_url: '',
  ip_address: '',
}

const TEMPLATE_HEADERS = ['플랫폼', '이름', '연락처', '계정아이디', '비밀번호', '네이버마이플레이스URL', 'IP']

function downloadTemplate() {
  const example = ['네이버', '홍길동', '010-1234-5678', 'acct_01', 'p@ssw0rd', 'https://m.place.naver.com/my/...', '123.45.67.89']
  // leading BOM so Excel opens the Korean headers as UTF-8 instead of guessing ANSI
  const csv = '﻿' + TEMPLATE_HEADERS.join(',') + '\n' + example.join(',') + '\n'
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
  const fileInputRef = useRef(null)

  function toRows(reviewers) {
    return reviewers.flatMap((r) =>
      r.accounts.length > 0
        ? r.accounts.map((a) => ({ ...a, reviewerId: r.id, name: r.name, contact_info: r.contact_info }))
        : [
            {
              id: null,
              reviewerId: r.id,
              name: r.name,
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
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.label.trim()) return
    setSubmitting(true)
    try {
      const reviewer = await api.createReviewer({
        category: 'admin',
        name: form.name.trim(),
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
        { ...account, reviewerId: reviewer.id, name: reviewer.name, contact_info: reviewer.contact_info },
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
    } catch (err) {
      alert(err.message)
    }
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) =>
      [row.name, row.contact_info, row.label, row.ip_address]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query)),
    )
  }, [rows, search])

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

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
          플랫폼/이름/연락처/계정아이디/비밀번호/URL/IP 컬럼이 있는 .xlsx 또는 .csv 파일 (이름과
          계정아이디가 둘 다 있는 행만 등록됩니다)
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
          <div className="relative w-64">
            <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름/연락처/계정아이디/IP 검색"
              className="w-full rounded border border-slate-300 py-1 pl-7 pr-2 text-sm"
            />
          </div>

          {filteredRows.length === 0 ? (
            <p className="text-sm text-slate-400">조건에 맞는 계정이 없습니다</p>
          ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">플랫폼</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">연락처</th>
                <th className="px-3 py-2">계정 아이디</th>
                <th className="px-3 py-2">비밀번호</th>
                <th className="px-3 py-2">네이버 마이플레이스 URL</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">상태</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row) => (
                <tr key={`${row.reviewerId}-${row.id ?? 'none'}`}>
                  <td className="px-3 py-2">
                    {row.platform === 'naver' ? '네이버' : row.platform === 'kakao' ? '카카오' : '-'}
                  </td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-slate-500">{row.contact_info || '-'}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1">
                      {row.label || '-'}
                      <CopyButton value={row.label} label="계정 아이디" />
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.password ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="tracking-widest text-slate-400">●●●●●●</span>
                        <CopyButton value={row.password} label="비밀번호" />
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.profile_url ? (
                      <a
                        href={row.profile_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        링크
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-3 py-2">{row.ip_address || '-'}</td>
                  <td className="px-3 py-2">
                    {row.id != null && (
                      <button
                        onClick={() => handleToggleLoginIssue(row)}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                          row.has_login_issue
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        }`}
                        title="로그인 문제 표시 토글"
                      >
                        <AlertTriangle size={12} />
                        {row.has_login_issue ? '로그인 문제' : '정상'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(row)}
                      className="text-slate-400 hover:text-red-600"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
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
    </div>
  )
}

import { Clipboard, ExternalLink, Plus } from 'lucide-react'
import { useState } from 'react'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'

const EMPTY = { platform: 'naver', label: '', profile_url: '', ip_address: '' }

export default function AccountForm({ onCreate, showIp = false }) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handlePasteUrl() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setForm((prev) => ({ ...prev, profile_url: text.trim() }))
    } catch {
      // 클립보드 권한이 없거나 지원 안 되는 환경(예: http) — 조용히 무시, 수동 입력으로 대체
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.label.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({
        platform: form.platform,
        label: form.label.trim(),
        profile_url: form.profile_url.trim() || null,
        ip_address: showIp ? form.ip_address.trim() || null : null,
      })
      setForm(EMPTY)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 pt-2">
      <div>
        <label className="block text-xs text-gray-500">플랫폼</label>
        <select
          value={form.platform}
          onChange={(e) => setForm({ ...form, platform: e.target.value })}
          className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
          <option value="naver">네이버</option>
          <option value="kakao">카카오</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500">계정 아이디</label>
        <Input
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          className="w-32"
        />
      </div>

      {form.platform === 'naver' && (
        <div>
          <label className="block text-xs text-gray-500">네이버 마이플레이스 URL</label>
          <div className="flex items-center gap-1">
            <Input
              value={form.profile_url}
              onChange={(e) => setForm({ ...form, profile_url: e.target.value })}
              placeholder="https://m.place.naver.com/my/..."
              className="w-64"
            />
            <button
              type="button"
              onClick={handlePasteUrl}
              className="rounded-btn border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-50"
              title="클립보드에서 붙여넣기"
            >
              <Clipboard size={14} />
            </button>
          </div>
        </div>
      )}

      {showIp && (
        <div>
          <label className="block text-xs text-gray-500">IP</label>
          <Input
            value={form.ip_address}
            onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
            placeholder="예: 123.45.67.89"
            className="w-36"
          />
        </div>
      )}

      <Button type="submit" disabled={submitting} variant="secondary" size="sm">
        <Plus size={14} />
        계정 추가
      </Button>
      {error && <span className="text-xs text-danger-text">{error}</span>}

      <div className="w-full space-y-0.5 text-xs text-gray-400">
        <p>· 계정 아이디는 여러 리뷰 계정을 구분하기 편하도록 적어두는 용도입니다.</p>
        {form.platform === 'naver' && (
          <p>
            · 마이플레이스 URL 찾는법 :{' '}
            <a
              href="https://m.place.naver.com/my"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-brand-600 hover:underline"
            >
              마이플레이스 열기
              <ExternalLink size={11} />
            </a>{' '}
            클릭 후 ▶ 내 프로필 공유아이콘 클릭 ▶ 링크복사 ▶ 붙여넣기
          </p>
        )}
      </div>
    </form>
  )
}

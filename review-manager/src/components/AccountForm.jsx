import { Plus } from 'lucide-react'
import { useState } from 'react'

const EMPTY = { platform: 'naver', label: '', profile_url: '', ip_address: '' }

export default function AccountForm({ onCreate, showIp = false }) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

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
        <label className="block text-xs text-slate-500">계정 아이디</label>
        <input
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="계정 닉네임"
          className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>

      {form.platform === 'naver' && (
        <div>
          <label className="block text-xs text-slate-500">네이버 마이플레이스 URL</label>
          <input
            value={form.profile_url}
            onChange={(e) => setForm({ ...form, profile_url: e.target.value })}
            placeholder="https://m.place.naver.com/my/..."
            className="w-64 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
      )}

      {showIp && (
        <div>
          <label className="block text-xs text-slate-500">IP</label>
          <input
            value={form.ip_address}
            onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
            placeholder="예: 123.45.67.89"
            className="w-36 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
      >
        <Plus size={14} />
        계정 추가
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}

      <div className="w-full space-y-0.5 text-xs text-slate-400">
        <p>· 계정 아이디는 여러 리뷰 계정을 구분하기 편하도록 적어두는 용도입니다 (실제 로그인 아이디가 아니어도 됩니다).</p>
        {form.platform === 'naver' && (
          <p>
            · 마이플레이스 URL 찾는 법: 네이버 지도 앱 → 하단 'MY' 탭 → 내 프로필 →
            공유 아이콘 → 링크 복사 (또는 PC: map.naver.com 로그인 → 우측 상단 프로필
            → 마이플레이스 → 주소창 URL 복사). 앱 버전에 따라 메뉴 위치가 다를 수
            있어요.
          </p>
        )}
      </div>
    </form>
  )
}

import { useState } from 'react'
import { api } from '../lib/api.js'

export default function AccountEditModal({ row, onClose, onSaved }) {
  const [name, setName] = useState(row.name || '')
  const [gender, setGender] = useState(row.gender || '')
  const [birthDate, setBirthDate] = useState(row.birth_date || '')
  const [contactInfo, setContactInfo] = useState(row.contact_info || '')
  const [platform, setPlatform] = useState(row.platform || 'naver')
  const [label, setLabel] = useState(row.label || '')
  const [password, setPassword] = useState(row.password || '')
  const [profileUrl, setProfileUrl] = useState(row.profile_url || '')
  const [ipAddress, setIpAddress] = useState(row.ip_address || '')
  const [adspowerProfileId, setAdspowerProfileId] = useState(row.adspower_profile_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const [reviewer, account] = await Promise.all([
        api.updateReviewer(row.reviewerId, {
          name: name.trim(),
          gender: gender || null,
          birth_date: birthDate || null,
          contact_info: contactInfo.trim() || null,
        }),
        api.updateAccount(row.id, {
          platform,
          label: label.trim(),
          password: password.trim() || null,
          profile_url: platform === 'naver' ? profileUrl.trim() || null : null,
          ip_address: ipAddress.trim() || null,
          adspower_profile_id: adspowerProfileId.trim() || null,
        }),
      ])
      onSaved({ ...row, ...account, name: reviewer.name, gender: reviewer.gender, birth_date: reviewer.birth_date, contact_info: reviewer.contact_info })
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
        className="w-full max-w-md space-y-3 rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-slate-800">계정 정보 수정</h3>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">성별</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">선택 안 함</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500">생년월일</label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">연락처</label>
          <input
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <div>
            <label className="block text-xs text-slate-500">플랫폼</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="naver">네이버</option>
              <option value="kakao">카카오</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">계정 아이디</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500">계정 비밀번호</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        {platform === 'naver' && (
          <div>
            <label className="block text-xs text-slate-500">네이버 마이플레이스 URL</label>
            <input
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-500">IP</label>
          <input
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500">AdsPower 프로필 ID (선택)</label>
          <input
            value={adspowerProfileId}
            onChange={(e) => setAdspowerProfileId(e.target.value)}
            placeholder="예: k1fapmng"
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <p className="mt-0.5 text-[11px] text-slate-400">
            설정하면 목록에서 "실행" 버튼으로 이 계정의 AdsPower 브라우저 창을 바로 띄울 수 있어요.
          </p>
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
            disabled={saving || !name.trim() || !label.trim()}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

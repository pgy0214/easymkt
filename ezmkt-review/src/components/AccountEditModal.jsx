import { useState } from 'react'
import { api } from '../lib/api.js'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'

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
  const [timeSlot, setTimeSlot] = useState(row.time_slot || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [detecting, setDetecting] = useState(false)

  async function handleDetectProfileUrl() {
    setDetecting(true)
    setError(null)
    try {
      const account = await api.detectProfileUrl(row.id)
      setProfileUrl(account.profile_url || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setDetecting(false)
    }
  }

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
          time_slot: timeSlot || null,
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
    <Modal open onClose={onClose} size="md">
      <h3 className="font-semibold text-gray-800">계정 정보 수정</h3>

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <label className="block text-xs text-gray-500">성별</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
          >
            <option value="">선택 안 함</option>
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
        </div>
      </div>
      <Input
        label="생년월일"
        type="date"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
      />
      <Input
        label="연락처"
        value={contactInfo}
        onChange={(e) => setContactInfo(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
        <div>
          <label className="block text-xs text-gray-500">플랫폼</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
          >
            <option value="naver">네이버</option>
            <option value="kakao">카카오</option>
          </select>
        </div>
        <Input
          label="계정 아이디"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <Input
        label="계정 비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {platform === 'naver' && (
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs text-gray-500">네이버 마이플레이스 URL</label>
            {adspowerProfileId.trim() && (
              <button
                type="button"
                onClick={handleDetectProfileUrl}
                disabled={detecting}
                className="text-xs text-brand-600 hover:underline disabled:opacity-50"
              >
                {detecting ? '감지 중...' : 'AdsPower에서 자동감지'}
              </button>
            )}
          </div>
          <Input
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
          />
          {adspowerProfileId.trim() && (
            <p className="mt-0.5 text-[11px] text-gray-400">
              AdsPower에서 이 계정이 이미 네이버에 로그인되어 있어야 감지됩니다.
            </p>
          )}
        </div>
      )}
      <Input
        label="IP"
        value={ipAddress}
        onChange={(e) => setIpAddress(e.target.value)}
      />
      <div>
        <Input
          label="AdsPower 프로필 ID (선택)"
          value={adspowerProfileId}
          onChange={(e) => setAdspowerProfileId(e.target.value)}
          placeholder="예: k1fapmng"
        />
        <p className="mt-0.5 text-[11px] text-gray-400">
          설정하면 목록에서 "실행" 버튼으로 이 계정의 AdsPower 브라우저 창을 바로 띄울 수 있어요.
        </p>
      </div>
      <div>
        <label className="block text-xs text-gray-500">시간대 (영수증 작성 시간대)</label>
        <select
          value={timeSlot}
          onChange={(e) => setTimeSlot(e.target.value)}
          className="w-full rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
        >
          <option value="">미배정 (영수증 생성 보류)</option>
          <option value="morning">오전 (11:00~15:00)</option>
          <option value="afternoon">오후 (15:00~18:00)</option>
          <option value="night">밤 (18:00~21:00)</option>
        </select>
        <p className="mt-0.5 text-[11px] text-gray-400">
          평소에는 목록의 "선택 시간대 랜덤배정" 버튼으로 자동 배정하고, 여기서는 특정
          계정만 수동으로 바꾸고 싶을 때 사용하세요.
        </p>
      </div>

      {error && <p className="text-xs text-danger-text">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={saving || !name.trim() || !label.trim()}
        >
          {saving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </Modal>
  )
}

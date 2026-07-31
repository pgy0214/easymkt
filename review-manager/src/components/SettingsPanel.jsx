import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function SettingsPanel() {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [notifyStatus, setNotifyStatus] = useState(null)

  useEffect(() => {
    api.getSettings().then(setSettings).catch((err) => setError(err.message))
    api.getNotifyStatus().then(setNotifyStatus).catch(() => {})
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const updated = await api.updateSettings(settings)
      setSettings(updated)
      setMessage('저장되었습니다. 다음 주기부터 바로 반영됩니다.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <p className="text-sm text-slate-400">불러오는 중...</p>

  return (
    <div className="mx-auto max-w-md space-y-4">
    <form
      onSubmit={handleSave}
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div>
        <label className="block text-sm font-medium text-slate-700">
          네이버 블라인드 확인 주기 (분)
        </label>
        <input
          type="number"
          min="1"
          value={settings.naver_blind_check_interval_minutes}
          onChange={(e) =>
            setSettings({
              ...settings,
              naver_blind_check_interval_minutes: Number(e.target.value),
            })
          }
          className="mt-1 w-32 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          카카오 블라인드 확인 주기 (분)
        </label>
        <input
          type="number"
          min="1"
          value={settings.kakao_blind_check_interval_minutes}
          onChange={(e) =>
            setSettings({
              ...settings,
              kakao_blind_check_interval_minutes: Number(e.target.value),
            })
          }
          className="mt-1 w-32 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div className="border-t border-slate-200 pt-4">
        <p className="text-xs text-slate-400">
          아래 두 값은 리뷰어가 작업을 클레임한 뒤 결과 링크를 제출하기까지 주어지는
          시간입니다. 넘기면 자동으로 다시 오픈풀에 공개됩니다. 캠페인 등록 시에는 더 이상
          개별 설정할 수 없고, 등록 시점의 이 값이 그대로 적용됩니다.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          네이버 작업 제한시간 (분)
        </label>
        <input
          type="number"
          min="1"
          value={settings.naver_default_claim_minutes}
          onChange={(e) =>
            setSettings({ ...settings, naver_default_claim_minutes: Number(e.target.value) })
          }
          className="mt-1 w-32 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          카카오 작업 제한시간 (분)
        </label>
        <input
          type="number"
          min="1"
          value={settings.kakao_default_claim_minutes}
          onChange={(e) =>
            setSettings({ ...settings, kakao_default_claim_minutes: Number(e.target.value) })
          }
          className="mt-1 w-32 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        저장
      </button>
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>

    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-medium text-slate-700">알림 발송 (문자 / 카카오 알림톡)</h3>
        <p className="mt-0.5 text-xs text-slate-400">
          리뷰어관리 탭에서 리뷰어를 선택하고 "선택 메시지 발송"으로 보낼 수 있습니다. 아래는
          자격증명 설정 여부입니다 — 값 자체는 보안상 이 화면에서 입력/노출하지 않고
          백엔드의 <code className="rounded bg-slate-100 px-1">.env</code> 파일에서만 관리합니다.
        </p>
      </div>
      {!notifyStatus ? (
        <p className="text-xs text-slate-400">확인 중...</p>
      ) : (
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span>문자(SMS)</span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                notifyStatus.sms_configured ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {notifyStatus.sms_configured ? '설정됨' : '설정 필요'}
            </span>
          </div>
          {!notifyStatus.sms_configured && (
            <p className="text-xs text-slate-400">
              .env에 <code className="rounded bg-slate-100 px-1">ALIGO_USER_ID</code>,{' '}
              <code className="rounded bg-slate-100 px-1">ALIGO_API_KEY</code>,{' '}
              <code className="rounded bg-slate-100 px-1">ALIGO_SENDER</code>를 채워주세요.
            </p>
          )}
          <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
            <span>카카오 알림톡</span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                notifyStatus.kakao_configured ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {notifyStatus.kakao_configured ? '설정됨' : '설정 필요'}
            </span>
          </div>
          {!notifyStatus.kakao_configured && (
            <p className="text-xs text-slate-400">
              위 SMS 자격증명에 더해 .env에{' '}
              <code className="rounded bg-slate-100 px-1">ALIGO_KAKAO_SENDER_KEY</code>
              (발신프로필키)를 채워주세요. 카카오 비즈니스 채널을 알리고에 연동하고 발송할
              템플릿을 사전 승인받는 절차는 알리고/카카오 쪽에서 별도로 진행하셔야 합니다.
            </p>
          )}
        </div>
      )}
    </div>
    </div>
  )
}

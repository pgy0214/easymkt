import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function SettingsPanel() {
  const [settings, setSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getSettings().then(setSettings).catch((err) => setError(err.message))
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
    <form
      onSubmit={handleSave}
      className="mx-auto max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-4"
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
  )
}

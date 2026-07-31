import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function BulkMessageModal({ reviewers, onClose }) {
  const [status, setStatus] = useState(null)
  const [channel, setChannel] = useState('sms')
  const [message, setMessage] = useState('')
  const [templateCode, setTemplateCode] = useState('')
  const [fallbackMessage, setFallbackMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getNotifyStatus().then(setStatus).catch((err) => setError(err.message))
  }, [])

  const noContactCount = reviewers.filter((r) => !r.contact_info).length
  const channelReady = status && (channel === 'sms' ? status.sms_configured : status.kakao_configured)

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    setError(null)
    try {
      const data = await api.sendBulkMessage({
        reviewer_ids: reviewers.map((r) => r.id),
        channel,
        message: message.trim(),
        template_code: channel === 'kakao' ? templateCode.trim() || null : null,
        fallback_message: channel === 'kakao' ? fallbackMessage.trim() || null : null,
      })
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg space-y-4 rounded-lg bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-slate-800">선택 메시지 발송 ({reviewers.length}명 선택됨)</h3>

        {noContactCount > 0 && (
          <p className="text-xs text-amber-600">
            선택한 사람 중 연락처가 없는 {noContactCount}명은 발송에서 자동 제외됩니다.
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setChannel('sms')}
            className={`flex-1 rounded border px-3 py-1.5 text-sm ${
              channel === 'sms' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'
            }`}
          >
            문자(SMS)
          </button>
          <button
            type="button"
            onClick={() => setChannel('kakao')}
            className={`flex-1 rounded border px-3 py-1.5 text-sm ${
              channel === 'kakao' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'
            }`}
          >
            카카오 알림톡
          </button>
        </div>

        {status && !channelReady && (
          <p className="text-xs text-red-600">
            {channel === 'sms'
              ? '문자 발송이 설정되지 않았습니다 — .env에 ALIGO_USER_ID/ALIGO_API_KEY/ALIGO_SENDER를 채워주세요.'
              : '카카오 알림톡이 설정되지 않았습니다 — .env에 ALIGO_KAKAO_SENDER_KEY를 채워주세요.'}
          </p>
        )}

        {channel === 'kakao' && (
          <div>
            <label className="block text-xs text-slate-500">템플릿 코드</label>
            <input
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value)}
              placeholder="알리고에 등록된 승인 템플릿 코드"
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-500">
            메시지 {channel === 'kakao' && '(승인된 템플릿 문구와 정확히 일치해야 발송됩니다)'}
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="안녕하세요 {name}님, 새 작업이 배정되었습니다. 포털에서 확인해주세요."
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <p className="mt-0.5 text-[11px] text-slate-400">{'{name}'} 은 수신자 이름으로 자동 치환됩니다.</p>
        </div>

        {channel === 'kakao' && (
          <div>
            <label className="block text-xs text-slate-500">실패 시 대체 문자 (선택)</label>
            <input
              value={fallbackMessage}
              onChange={(e) => setFallbackMessage(e.target.value)}
              placeholder="알림톡 실패 시 대신 보낼 문자 내용"
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
        )}

        {results && (
          <div className="space-y-1 rounded border border-blue-100 bg-blue-50 p-3 text-sm">
            <p className="font-medium text-blue-800">
              발송 완료: 성공 {results.filter((r) => r.success).length}건 · 실패{' '}
              {results.filter((r) => !r.success).length}건
            </p>
            {results.some((r) => !r.success) && (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-slate-600">
                {results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <li key={r.reviewer_id}>
                      {r.name} — {r.reason}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!message.trim() || sending || (channel === 'kakao' && !templateCode.trim())}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? '발송 중...' : '발송'}
          </button>
        </div>
      </div>
    </div>
  )
}

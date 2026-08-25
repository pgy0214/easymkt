import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'

export default function BulkMessageModal({ reviewers, onClose, initialMessage = '' }) {
  const [status, setStatus] = useState(null)
  const [channel, setChannel] = useState('sms')
  const [message, setMessage] = useState(initialMessage)
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
    <Modal open onClose={onClose} size="lg">
      <h3 className="font-semibold text-gray-800">선택 메시지 발송 ({reviewers.length}명 선택됨)</h3>

      {noContactCount > 0 && (
        <p className="text-xs text-amber-600">
          선택한 사람 중 연락처가 없는 {noContactCount}명은 발송에서 자동 제외됩니다.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setChannel('sms')}
          className={`flex-1 rounded-btn border px-3 py-1.5 text-sm ${
            channel === 'sms' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-300 text-gray-600'
          }`}
        >
          문자(SMS)
        </button>
        <button
          type="button"
          onClick={() => setChannel('kakao')}
          className={`flex-1 rounded-btn border px-3 py-1.5 text-sm ${
            channel === 'kakao' ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-300 text-gray-600'
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
        <Input
          label="템플릿 코드"
          value={templateCode}
          onChange={(e) => setTemplateCode(e.target.value)}
          placeholder="알리고에 등록된 승인 템플릿 코드"
        />
      )}

      <div>
        <label className="block text-xs text-gray-500">
          메시지 {channel === 'kakao' && '(승인된 템플릿 문구와 정확히 일치해야 발송됩니다)'}
        </label>
        <textarea
          lang="ko"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="안녕하세요 {name}님, 새 작업이 배정되었습니다. 포털에서 확인해주세요."
          className="w-full rounded-btn border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <p className="mt-0.5 text-[11px] text-gray-400">{'{name}'} 은 수신자 이름으로 자동 치환됩니다.</p>
      </div>

      {channel === 'kakao' && (
        <Input
          label="실패 시 대체 문자 (선택)"
          value={fallbackMessage}
          onChange={(e) => setFallbackMessage(e.target.value)}
          placeholder="알림톡 실패 시 대신 보낼 문자 내용"
        />
      )}

      {results && (
        <div className="space-y-1 rounded-card border border-brand-100 bg-brand-50 p-3 text-sm">
          <p className="font-medium text-brand-700">
            발송 완료: 성공 {results.filter((r) => r.success).length}건 · 실패{' '}
            {results.filter((r) => !r.success).length}건
          </p>
          {results.some((r) => !r.success) && (
            <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-gray-600">
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
        <Button type="button" variant="outline" onClick={onClose}>
          닫기
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSend}
          disabled={!message.trim() || sending || (channel === 'kakao' && !templateCode.trim())}
        >
          {sending ? '발송 중...' : '발송'}
        </Button>
      </div>
    </Modal>
  )
}

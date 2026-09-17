import { AlertTriangle, Copy, FileText, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { PLATFORM_LABEL, TONE_PRESET_LABEL } from '../lib/format.js'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'
import Input from './ui/Input.jsx'

const MAX_COUNT = 30

export default function DraftGenerator() {
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [targetId, setTargetId] = useState('')
  const [count, setCount] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    api
      .getTargets()
      .then(setTargets)
      .finally(() => setLoading(false))
  }, [])

  const target = targets.find((t) => t.id === Number(targetId)) ?? null
  const hasGuideline = target && (target.guideline || target.regional_features || target.tone)

  async function handleGenerate() {
    if (!target) return
    setGenerating(true)
    setError(null)
    setLastResult(null)
    try {
      const created = await api.generateTargetReviewTexts(target.id, count)
      setTargets((prev) =>
        prev.map((t) =>
          t.id === target.id ? { ...t, review_texts: [...t.review_texts, ...created] } : t,
        ),
      )
      const flaggedCount = created.filter((t) => t.warnings?.length > 0).length
      setLastResult({ total: created.length, flaggedCount })
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete(textId) {
    await api.deleteTargetReviewText(target.id, textId)
    setTargets((prev) =>
      prev.map((t) =>
        t.id === target.id
          ? { ...t, review_texts: t.review_texts.filter((r) => r.id !== textId) }
          : t,
      ),
    )
  }

  async function handleCopy(text) {
    await navigator.clipboard.writeText(text.content)
    setCopiedId(text.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        캠페인에 등록된 가이드라인/지역적 특징/말투/메뉴 정보를 바탕으로 리뷰 원고를 미리
        생성해 원고 풀에 쌓아둘 수 있어요. 생성된 원고는 작업 배정 시 업로드 원고와 똑같이
        순서대로 사용됩니다.
      </p>

      <div className="flex flex-wrap items-end gap-2 rounded-card border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-xs text-gray-500">캠페인</label>
          <select
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value)
              setError(null)
            }}
            className="w-72 rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
          >
            <option value="">캠페인 선택</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                [{PLATFORM_LABEL[t.platform]}] {t.store_name} · 원고 {t.review_texts.length}/
                {t.required_count}건
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">생성할 개수 (최대 {MAX_COUNT})</label>
          <Input
            type="number"
            min="1"
            max={MAX_COUNT}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(MAX_COUNT, Number(e.target.value) || 1)))}
            className="w-20"
          />
        </div>
        <Button onClick={handleGenerate} disabled={!target || generating}>
          <Sparkles size={14} />
          {generating ? '생성 중...' : '원고 생성'}
        </Button>
      </div>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}

      {target && (
        <div className="space-y-1.5 rounded-card border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700">
          <p className="text-gray-400">이 캠페인에 등록된 참고 자료 (읽기 전용)</p>
          <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1">
            <span className="text-gray-400">가이드라인</span>
            <span className="whitespace-pre-wrap">{target.guideline || '-'}</span>
            <span className="text-gray-400">지역적 특징</span>
            <span>{target.regional_features || '-'}</span>
            <span className="text-gray-400">말투</span>
            <span>
              {TONE_PRESET_LABEL[target.tone_preset] || TONE_PRESET_LABEL.friendly}
              {target.tone ? ` · ${target.tone}` : ''}
            </span>
            <span className="text-gray-400">금지어</span>
            <span>{target.forbidden_words || '-'}</span>
            <span className="text-gray-400">메뉴</span>
            <span>
              {target.menu_items?.length
                ? target.menu_items.map((m) => `${m.name}(${m.price}원)`).join(', ')
                : '-'}
            </span>
            <span className="text-gray-400">목표 글자수</span>
            <span>{target.review_length}자 내외</span>
          </div>
        </div>
      )}

      {target && !hasGuideline && (
        <p className="text-sm text-amber-600">
          이 캠페인은 가이드라인/지역특징/말투가 등록되어 있지 않아요. 참고 자료 없이 일반적인
          방문 후기 형태로 생성됩니다. 더 정확한 원고가 필요하면 캠페인 등록/목록에서 먼저
          채워주세요.
        </p>
      )}

      {error && <p className="text-sm text-danger-text">{error}</p>}

      {lastResult && (
        <p
          className={`flex items-center gap-1.5 text-sm ${
            lastResult.flaggedCount > 0 ? 'text-danger-text' : 'text-green-600'
          }`}
        >
          {lastResult.flaggedCount > 0 ? <AlertTriangle size={14} /> : <FileText size={14} />}
          {lastResult.total}건 생성 완료 —{' '}
          {lastResult.flaggedCount > 0
            ? `${lastResult.flaggedCount}건 확인 필요 (아래 카드에서 표시 확인)`
            : '전부 정상 (금지어/중복/글자수 이상 없음)'}
        </p>
      )}

      {target && target.review_texts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">원고 풀 {target.review_texts.length}건</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {target.review_texts.map((text) => (
              <Card key={text.id} padding="sm">
                <p className="whitespace-pre-wrap text-sm text-gray-800">{text.content}</p>
                {text.warnings?.length > 0 && (
                  <p className="mt-1.5 flex items-start gap-1 text-xs text-danger-text">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {text.warnings.join(' · ')}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <button
                    onClick={() => handleCopy(text)}
                    className="flex items-center gap-1 text-brand-600 hover:underline"
                  >
                    <Copy size={12} />
                    {copiedId === text.id ? '복사됨' : '복사'}
                  </button>
                  <button
                    onClick={() => handleDelete(text.id)}
                    className="flex items-center gap-1 text-danger-text hover:underline"
                  >
                    <Trash2 size={12} />
                    삭제
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {target && target.review_texts.length === 0 && !generating && (
        <p className="flex items-center gap-1.5 text-sm text-gray-400">
          <FileText size={14} />
          아직 생성된 원고가 없어요.
        </p>
      )}
    </div>
  )
}

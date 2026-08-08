import { Check, Download } from 'lucide-react'
import { useState } from 'react'

// 네이버 "사진 첨부"는 보통 기기의 파일/갤러리 선택창을 여는 방식이라 클립보드
// 붙여넣기가 안 통할 수 있다 — 이 버튼은 이미지를 기기에 파일로 저장해서, 그
// 파일 선택창에서 직접 골라 첨부할 수 있게 하는 대안이다(복사하기와 병행 제공).
async function downloadImage(url, filename) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('이미지를 불러오지 못했습니다')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(objectUrl)
}

export default function ImageDownloadButton({ src, filename, label, size = 'sm' }) {
  const [state, setState] = useState('idle') // idle | saving | saved | error

  async function handleClick() {
    setState('saving')
    try {
      await downloadImage(src, filename)
      setState('saved')
      setTimeout(() => setState('idle'), 1200)
    } catch (err) {
      setState('error')
      alert(err.message || '이미지 저장에 실패했습니다')
      setState('idle')
    }
  }

  if (size === 'lg') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'saving'}
        className={`inline-flex items-center gap-1.5 rounded-lg border-2 px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
          state === 'saved'
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
        }`}
      >
        {state === 'saved' ? <Check size={16} /> : <Download size={16} />}
        {state === 'saving' ? '저장 중...' : state === 'saved' ? '저장됨' : label ? `${label} 다운로드` : '다운로드'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'saving'}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs disabled:opacity-50 ${
        state === 'saved'
          ? 'border-green-300 text-green-600'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
      title={label ? `${label} 다운로드` : '이미지 다운로드'}
    >
      {state === 'saved' ? <Check size={12} /> : <Download size={12} />}
      {state === 'saving' ? '저장 중...' : state === 'saved' ? '저장됨' : label || '다운로드'}
    </button>
  )
}

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

// 이미지를 클립보드에 그림 형태로 복사 — 네이버 리뷰 작성 화면에 Ctrl+V로 바로
// 붙여넣을 수 있게 하는 용도. Clipboard API는 PNG만 안정적으로 지원해서, 원본이
// JPG여도 canvas로 한 번 그려서 PNG로 변환한 뒤 복사한다. blob: URL을 거치기
// 때문에 원본이 다른 포트(교차 출처)여도 canvas가 오염되지 않는다.
async function copyImageToClipboard(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('이미지를 불러오지 못했습니다')
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('이미지를 열지 못했습니다'))
      img.src = objectUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    const pngBlob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('변환 실패'))), 'image/png'),
    )
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })])
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export default function ImageCopyButton({ src, label }) {
  const [state, setState] = useState('idle') // idle | copying | copied | error

  async function handleClick() {
    setState('copying')
    try {
      await copyImageToClipboard(src)
      setState('copied')
      setTimeout(() => setState('idle'), 1200)
    } catch (err) {
      setState('error')
      alert(err.message || '이미지 복사에 실패했습니다 — 브라우저가 지원하지 않을 수 있어요')
      setState('idle')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state === 'copying'}
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs disabled:opacity-50 ${
        state === 'copied'
          ? 'border-green-300 text-green-600'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50'
      }`}
      title={label ? `${label} 복사` : '이미지 복사'}
    >
      {state === 'copied' ? <Check size={12} /> : <Copy size={12} />}
      {state === 'copying' ? '복사 중...' : state === 'copied' ? '복사됨' : label || '이미지 복사'}
    </button>
  )
}

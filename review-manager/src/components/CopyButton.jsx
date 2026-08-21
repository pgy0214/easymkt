import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export default function CopyButton({ value, label, size = 'sm' }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard API unavailable (e.g. non-HTTPS context) — silently ignore
    }
  }

  if (!value) return null

  if (size === 'lg') {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={`inline-flex items-center gap-1.5 rounded-card border-2 px-4 py-2 text-sm font-semibold ${
          copied
            ? 'border-success-bg bg-success-bg text-success-text'
            : 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
        }`}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? '복사됨' : label ? `${label} 복사하기` : '복사하기'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center rounded-pill p-0.5 ${
        copied ? 'text-success-text' : 'text-gray-400 hover:text-gray-700'
      }`}
      title={label ? `${label} 복사` : '복사'}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

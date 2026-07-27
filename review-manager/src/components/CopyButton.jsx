import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export default function CopyButton({ value, label }) {
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

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center rounded p-0.5 ${
        copied ? 'text-green-600' : 'text-slate-400 hover:text-slate-700'
      }`}
      title={label ? `${label} 복사` : '복사'}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  )
}

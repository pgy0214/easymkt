import { useState } from 'react'
import { api } from '../lib/api.js'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'

export default function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await api.login(username.trim(), password)
      onLoggedIn(result.token)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-card border border-gray-200 bg-white p-6">
        <h1 className="mb-4 text-lg font-semibold text-gray-900">
          이지리뷰 <span className="font-normal text-gray-400">관리자 로그인</span>
        </h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            className="w-full"
          />
          <Input
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full"
          />
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? '로그인 중...' : '로그인'}
          </Button>
          {error && <p className="text-sm text-danger-text">{error}</p>}
        </form>
      </div>
    </div>
  )
}

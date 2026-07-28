import { Plus } from 'lucide-react'
import { useState } from 'react'
import { AGE_GROUP_OPTIONS, GENDER_LABEL, REVIEWER_CATEGORY_LABEL } from '../lib/format.js'

const EMPTY = {
  category: 'reviewer',
  name: '',
  memo: '',
  contact_info: '',
  region: '',
  blog_url: '',
  blog_index: '',
  age_group: '',
  gender: '',
}

export default function ReviewerForm({ onCreate }) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const isExperience = form.category === 'experience'

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await onCreate({
        category: form.category,
        name: form.name.trim(),
        memo: form.memo.trim() || null,
        contact_info: form.contact_info.trim() || null,
        region: isExperience ? form.region.trim() || null : null,
        blog_url: isExperience ? form.blog_url.trim() || null : null,
        blog_index: isExperience ? form.blog_index.trim() || null : null,
        age_group: isExperience ? form.age_group || null : null,
        gender: isExperience ? form.gender || null : null,
      })
      setForm({ ...EMPTY, category: form.category })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div>
        <label className="block text-xs text-slate-500">카테고리</label>
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {/* 관리자(자체보유계정)는 "관리자 계정" 탭에서 별도로 등록 */}
          {Object.entries(REVIEWER_CATEGORY_LABEL)
            .filter(([value]) => value !== 'admin')
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-500">이름</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">연락수단 (카톡ID/전화번호 등)</label>
        <input
          value={form.contact_info}
          onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
          className="w-56 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      {isExperience && (
        <>
          <div>
            <label className="block text-xs text-slate-500">지역</label>
            <input
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              placeholder="예: 서울 강남구"
              className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">블로그 주소</label>
            <input
              value={form.blog_url}
              onChange={(e) => setForm({ ...form, blog_url: e.target.value })}
              placeholder="https://blog.naver.com/..."
              className="w-48 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">지수</label>
            <input
              value={form.blog_index}
              onChange={(e) => setForm({ ...form, blog_index: e.target.value })}
              placeholder="예: 최적화, 85"
              className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">연령대</label>
            <select
              value={form.age_group}
              onChange={(e) => setForm({ ...form, age_group: e.target.value })}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">선택안함</option>
              {AGE_GROUP_OPTIONS.map((age) => (
                <option key={age} value={age}>
                  {age}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">성별</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="">선택안함</option>
              {Object.entries(GENDER_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <div>
        <label className="block text-xs text-slate-500">메모</label>
        <input
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
          className="w-40 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Plus size={14} />
        리뷰어 추가
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  )
}

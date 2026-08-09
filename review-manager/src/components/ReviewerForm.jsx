import { ExternalLink, Plus } from 'lucide-react'
import { useState } from 'react'
import { AGE_GROUP_OPTIONS, GENDER_LABEL, REGION_GROUPS, REVIEWER_CATEGORY_LABEL } from '../lib/format.js'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'

function emptyForm(fixedCategory) {
  return {
    category: fixedCategory ?? 'reviewer',
    name: '',
    memo: '',
    contact_info: '',
    region: '',
    blog_url: '',
    blog_index: '',
    age_group: '',
    gender: '',
  }
}

export default function ReviewerForm({ onCreate, fixedCategory }) {
  const [form, setForm] = useState(() => emptyForm(fixedCategory))
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
      setForm(emptyForm(fixedCategory ?? form.category))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-card border border-gray-200 bg-white p-4"
    >
      {!fixedCategory && (
        <div>
          <label className="block text-xs text-gray-500">카테고리</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
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
      )}
      <div>
        <label className="block text-xs text-gray-500">이름</label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-32"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500">연락수단 (카톡ID/전화번호 등)</label>
        <Input
          value={form.contact_info}
          onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
          className="w-56"
        />
      </div>
      {isExperience && (
        <>
          <div>
            <label className="block text-xs text-gray-500">지역</label>
            <select
              value={form.region}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
              <option value="">선택안함</option>
              {REGION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500">블로그 주소</label>
            <div className="flex items-center gap-1">
              <Input
                value={form.blog_url}
                onChange={(e) => setForm({ ...form, blog_url: e.target.value })}
                placeholder="https://blog.naver.com/..."
                className="w-48"
              />
              <a
                href="https://blogdex.space/lookup"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 whitespace-nowrap rounded-btn border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              >
                블덱스 바로가기
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500">지수</label>
            <Input
              value={form.blog_index}
              onChange={(e) => setForm({ ...form, blog_index: e.target.value })}
              placeholder="예: 최적화, 85"
              className="w-24"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">연령대</label>
            <select
              value={form.age_group}
              onChange={(e) => setForm({ ...form, age_group: e.target.value })}
              className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
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
            <label className="block text-xs text-gray-500">성별</label>
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              className="rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
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
        <label className="block text-xs text-gray-500">메모</label>
        <Input
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
          className="w-40"
        />
      </div>
      <Button type="submit" disabled={submitting}>
        <Plus size={14} />
        리뷰어 추가
      </Button>
      {error && <span className="text-xs text-danger-text">{error}</span>}
    </form>
  )
}

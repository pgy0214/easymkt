import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { formatDateTime, GENDER_LABEL, REVIEWER_CATEGORY_LABEL } from '../lib/format.js'
import Badge from './ui/Badge.jsx'
import Input from './ui/Input.jsx'
import Pagination from './Pagination.jsx'

const CATEGORY_COLOR = {
  admin: 'purple',
  reviewer: 'gray',
  experience: 'pink',
  press: 'sky',
}

export default function MemberManager() {
  const [reviewers, setReviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    api
      .getReviewers()
      .then(setReviewers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // 아이디/비밀번호를 직접 지정해 셀프 회원가입을 완료한 회원만 — 관리자가
  // 엑셀로 미리 올려둔 정보만 있고 아직 가입하지 않은 행은 제외한다.
  const members = useMemo(() => {
    const q = search.trim()
    return reviewers
      .filter((r) => !!r.username)
      .filter(
        (r) =>
          !q ||
          r.name.includes(q) ||
          r.username.includes(q) ||
          (r.contact_info || '').includes(q),
      )
  }, [reviewers, search])

  useEffect(() => setPage(1), [search])

  const paged = members.slice((page - 1) * pageSize, page * pageSize)

  if (loading) return <p className="text-sm text-gray-400">불러오는 중...</p>
  if (error) return <p className="text-sm text-danger-text">{error}</p>

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">회원관리</h2>
        <p className="text-xs text-gray-400">아이디/비밀번호로 직접 회원가입을 완료한 회원의 가입 정보입니다</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="아이디/이름/연락처 검색"
          className="max-w-xs"
        />
        <p className="shrink-0 text-xs text-gray-400">전체 {members.length}명</p>
      </div>

      {paged.length === 0 && <p className="text-sm text-gray-400">가입한 회원이 없습니다.</p>}

      {paged.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">카테고리</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">연락처</th>
                <th className="px-3 py-2">활동</th>
                <th className="px-3 py-2">동의</th>
                <th className="px-3 py-2">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map((r) => {
                const accountCount = r.accounts?.length ?? 0
                const hasReviewerActivity = accountCount > 0
                const hasExperienceActivity = !!(r.blog_url || r.region || r.age_group || r.topics)
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2 align-top">
                      <Badge color={CATEGORY_COLOR[r.category]}>{REVIEWER_CATEGORY_LABEL[r.category]}</Badge>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-800">{r.name}</span>
                        <span className="text-xs text-gray-400">@{r.username}</span>
                        {r.gender && (
                          <Badge color={r.gender === 'male' ? 'sky' : 'rose'}>{GENDER_LABEL[r.gender]}</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-gray-600">{r.contact_info || '-'}</td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        {hasReviewerActivity && <Badge variant="info">리뷰단 {accountCount}개</Badge>}
                        {hasExperienceActivity && <Badge color="pink">체험단 1개</Badge>}
                        {!hasReviewerActivity && !hasExperienceActivity && (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={r.privacy_consent ? 'success' : 'neutral'}>
                          개인정보 {r.privacy_consent ? 'O' : 'X'}
                        </Badge>
                        <Badge variant={r.marketing_consent ? 'success' : 'neutral'}>
                          마케팅 {r.marketing_consent ? 'O' : 'X'}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-gray-400">
                      {formatDateTime(r.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        totalCount={members.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  )
}

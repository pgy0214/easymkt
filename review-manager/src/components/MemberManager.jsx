import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api, API_ORIGIN } from '../lib/api.js'
import { formatDateTime, GENDER_LABEL } from '../lib/format.js'
import Badge from './ui/Badge.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'
import Pagination from './Pagination.jsx'

// 회원관리 화면에서 다루는 회원 종류는 관리자/광고주/리뷰어 세 가지뿐이다(광고주는
// 아직 자체 페이지가 없어 데이터는 없지만 범례로만 안내). 관리자가 엑셀로
// 미리 올려둔 category 값(체험단/기자단 등)은 여기서는 전부 "리뷰어"로 보여준다 —
// 그 구분은 "계정 > 리뷰어 관리" 쪽 CRM 분류이지 회원 종류가 아니기 때문.
// 'admin'은 자체보유(리뷰포스팅용) 계정이 아니라 /admin 대시보드에 로그인 가능한
// 사람을 뜻한다 — 비활성화하면 그 계정은 대시보드 로그인이 막힌다.
const MEMBER_TYPES = [
  { value: 'admin', label: '관리자', color: 'purple' },
  { value: 'advertiser', label: '광고주', color: 'yellow' },
  { value: 'reviewer', label: '리뷰어', color: 'gray' },
]

function memberType(category) {
  return MEMBER_TYPES.find((t) => t.value === category) ?? MEMBER_TYPES[2]
}

const EMPTY_MEMBER = { category: 'reviewer', name: '', username: '', password: '', contact_info: '' }

export default function MemberManager() {
  const [reviewers, setReviewers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [addOpen, setAddOpen] = useState(false)
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    api
      .getReviewers()
      .then(setReviewers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleAddMember(e) {
    e.preventDefault()
    setAddSubmitting(true)
    setAddError(null)
    try {
      const created = await api.createMember(memberForm)
      setReviewers((prev) => [...prev, created])
      setAddOpen(false)
      setMemberForm(EMPTY_MEMBER)
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAddSubmitting(false)
    }
  }

  async function handleGrantAdvertiser(reviewer) {
    if (!confirm(`${reviewer.name}(@${reviewer.username})에게 광고주 권한을 부여할까요?`)) return
    try {
      const updated = await api.updateReviewer(reviewer.id, { category: 'advertiser' })
      setReviewers((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleToggleActive(reviewer) {
    try {
      const updated = await api.updateReviewer(reviewer.id, { is_active: !reviewer.is_active })
      setReviewers((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch (err) {
      alert(err.message)
    }
  }

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
      .slice()
      .sort((a, b) => {
        const typeDiff = MEMBER_TYPES.findIndex((t) => t.value === a.category) -
          MEMBER_TYPES.findIndex((t) => t.value === b.category)
        if (typeDiff !== 0) return typeDiff
        // 광고주 그룹 안에서는 승인 대기(is_active === false)인 사람을 맨 위로.
        if (a.category === 'advertiser') {
          const activeDiff = Number(a.is_active) - Number(b.is_active)
          if (activeDiff !== 0) return activeDiff
        }
        return 0
      })
  }, [reviewers, search])

  useEffect(() => setPage(1), [search])

  const paged = members.slice((page - 1) * pageSize, page * pageSize)

  if (loading) return <p className="text-sm text-gray-400">불러오는 중...</p>
  if (error) return <p className="text-sm text-danger-text">{error}</p>

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">회원관리</h2>
          <p className="text-xs text-gray-400">아이디/비밀번호로 직접 회원가입을 완료한 회원의 가입 정보입니다</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setMemberForm(EMPTY_MEMBER)
            setAddError(null)
            setAddOpen(true)
          }}
        >
          <Plus size={14} className="mr-1 inline" />
          회원 임의 추가
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="아이디/이름/연락처 검색"
          className="max-w-xs"
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">회원 종류</span>
          {MEMBER_TYPES.map((t) => (
            <Badge key={t.value} color={t.color}>
              {t.label}
            </Badge>
          ))}
        </div>
        <p className="ml-auto shrink-0 text-xs text-gray-400">전체 {members.length}명</p>
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
                <th className="px-3 py-2">지역</th>
                <th className="px-3 py-2">활동</th>
                <th className="px-3 py-2">사업자등록증</th>
                <th className="px-3 py-2">동의</th>
                <th className="px-3 py-2">등록일</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paged.map((r) => {
                const accountCount = r.accounts?.length ?? 0
                const hasReviewerActivity = accountCount > 0
                const hasExperienceActivity = !!r.blog_url
                const type = memberType(r.category)
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2 align-top">
                      <Badge color={type.color}>{type.label}</Badge>
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
                    <td className="px-3 py-2 align-top text-gray-600">{r.region || '-'}</td>
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
                      {r.category === 'advertiser' ? (
                        r.business_registration_image_path ? (
                          <a
                            href={`${API_ORIGIN}${r.business_registration_image_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-brand-600 hover:underline"
                          >
                            이미지 확인
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">미제출</span>
                        )
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
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
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <button
                          onClick={() => handleToggleActive(r)}
                          className={`whitespace-nowrap text-xs hover:underline ${
                            r.is_active ? 'text-gray-500' : 'text-brand-600 font-medium'
                          }`}
                        >
                          {r.is_active ? '비활성화' : '활성화'}
                        </button>
                        {r.category !== 'advertiser' && r.category !== 'admin' && r.category !== 'reviewer' && (
                          <button
                            onClick={() => handleGrantAdvertiser(r)}
                            className="whitespace-nowrap text-xs text-brand-600 hover:underline"
                          >
                            광고주 권한 부여
                          </button>
                        )}
                      </div>
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)}>
        <h3 className="mb-3 font-semibold text-gray-800">회원 임의 추가</h3>
        <p className="mb-3 text-xs text-gray-400">
          전화번호 인증 없이 아이디/비밀번호를 바로 지정해서 가입 완료 상태로 만듭니다.
        </p>
        <form onSubmit={handleAddMember} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500">회원 종류</label>
            <select
              value={memberForm.category}
              onChange={(e) => setMemberForm((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            >
              {MEMBER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500">이름</label>
            <Input
              value={memberForm.name}
              onChange={(e) => setMemberForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">아이디</label>
            <Input
              value={memberForm.username}
              onChange={(e) => setMemberForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder="영문 소문자/숫자/밑줄 4~20자"
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">비밀번호</label>
            <Input
              value={memberForm.password}
              onChange={(e) => setMemberForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="4자 이상"
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">연락처</label>
            <Input
              value={memberForm.contact_info}
              onChange={(e) => setMemberForm((prev) => ({ ...prev, contact_info: e.target.value }))}
              className="w-full"
            />
          </div>
          {addError && <p className="text-sm text-danger-text">{addError}</p>}
          <Button type="submit" variant="primary" disabled={addSubmitting} className="w-full">
            {addSubmitting ? '추가 중...' : '추가'}
          </Button>
        </form>
      </Modal>
    </div>
  )
}

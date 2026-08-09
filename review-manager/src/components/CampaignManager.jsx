import { Plus, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, API_ORIGIN, experienceCampaignApi } from '../lib/api.js'
import Badge from './ui/Badge.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'

const CAMPAIGN_TYPES = ['방문형', '배송형']
const CONTENT_TYPES = ['블로그', '인스타그램', '유튜브', '틱톡']
const CONTACT_METHODS = ['문자', '전화']

const DEFAULT_GUIDELINE = [
  '* 촬영 및 내용 가이드라인',
  '',
  ' -  매장 외관 및 내부 인테리어 사진 등을 포함해 사진 20장, 동영상 1개 이상 촬영해주세요',
  ' -  ㅇㅇ맛을 강조해주세요, ㅇㅇㅇ 컨텐츠를 강조해주세요',
  ' -  네이버지도를 반드시 추가해주세요',
  ' -  상품의 차별성 및 특징, 지리적위치 특이점, 판매상품 강조 해주세요.',
].join('\n')

// <input type="datetime-local">가 주는 값은 타임존 정보가 없는 "내 지역 시각"
// 문자열이다 — 그대로 서버로 보내면 백엔드가 UTC로 오해해서(예: 한국은 UTC+9)
// 모집기간 필터(recruit_start <= now <= recruit_end)가 9시간 어긋난다. new Date()로
// 브라우저 로컬시각으로 해석한 뒤 UTC로 변환해서 보낸다(서버의 utcnow()와 동일한 표기).
function toUtcNaiveIso(localValue) {
  if (!localValue) return null
  return new Date(localValue).toISOString().slice(0, 19)
}

// 반대로 서버가 돌려준 값(타임존 표기 없는 UTC 문자열)을 화면에 보여줄 땐 'Z'를 붙여
// UTC로 해석시킨 뒤 로컬시각으로 변환한다.
function formatUtcToLocal(value) {
  if (!value) return ''
  const date = new Date(value.includes('Z') ? value : `${value}Z`)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const EMPTY = {
  store_id: '',
  campaign_type: '방문형',
  content_type: '블로그',
  benefit_type: '선착순 제공',
  product_name: '',
  product_price: '',
  capacity: 5,
  content_guide: DEFAULT_GUIDELINE,
  main_keyword: '',
  sub_keyword: '',
  reservation_required: false,
  contact_name: '',
  contact_method: '문자',
  contact_info: '',
  extra_info: '',
  recruit_start: '',
  recruit_end: '',
  review_deadline: '',
  is_recurring: false,
}

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [applicantsCampaign, setApplicantsCampaign] = useState(null)
  const [campaignImage, setCampaignImage] = useState(null)

  async function refresh() {
    setLoading(true)
    try {
      setCampaigns(await experienceCampaignApi.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    api.getStores().then(setStores).catch(() => {})
  }, [])

  function openRegister() {
    setForm({ ...EMPTY, store_id: stores[0]?.id ?? '' })
    setCampaignImage(null)
    setError(null)
    setRegisterOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.store_id) {
      setError('업체를 선택해주세요.')
      return
    }
    if (!form.recruit_start || !form.recruit_end) {
      setError('모집 게시일시(시작~종료)를 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await experienceCampaignApi.create({
        store_id: Number(form.store_id),
        campaign_type: form.campaign_type,
        content_type: form.content_type,
        benefit_type: '선착순 제공',
        product_name: form.product_name.trim(),
        product_price: form.product_price === '' ? null : Number(form.product_price),
        capacity: Number(form.capacity),
        content_guide: form.content_guide.trim() || null,
        main_keyword: form.main_keyword.trim() || null,
        sub_keyword: form.sub_keyword.trim() || null,
        reservation_required: form.reservation_required,
        contact_name: form.contact_name.trim() || null,
        contact_method: form.contact_method || null,
        contact_info: form.contact_info.trim() || null,
        extra_info: form.extra_info.trim() || null,
        recruit_start: toUtcNaiveIso(form.recruit_start),
        recruit_end: toUtcNaiveIso(form.recruit_end),
        review_deadline: form.review_deadline || null,
        is_recurring: form.is_recurring,
      })
      if (campaignImage) {
        await experienceCampaignApi.uploadImage(created.id, campaignImage)
      }
      setRegisterOpen(false)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('이 캠페인을 삭제할까요?')) return
    try {
      await experienceCampaignApi.delete(id)
      await refresh()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">캠페인관리</h2>
        <Button variant="primary" onClick={openRegister}>
          <Plus size={14} />
          캠페인 등록
        </Button>
      </div>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {!loading && campaigns.length === 0 && (
        <p className="text-sm text-gray-400">등록된 캠페인이 없습니다</p>
      )}

      {campaigns.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-gray-200 bg-white">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">매장</th>
                <th className="px-3 py-2">유형</th>
                <th className="px-3 py-2">콘텐츠</th>
                <th className="px-3 py-2">상품</th>
                <th className="px-3 py-2">신청/정원</th>
                <th className="px-3 py-2">모집기간</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {c.image_path && (
                        <img
                          src={`${API_ORIGIN}${c.image_path}`}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-btn object-cover"
                        />
                      )}
                      <div>
                        <div className="font-medium text-gray-800">{c.store_name}</div>
                        {c.store_region && <div className="text-xs text-gray-400">{c.store_region}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="info">{c.campaign_type}</Badge>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{c.content_type}</td>
                  <td className="px-3 py-2 text-gray-600">{c.product_name}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {c.applicant_count} / {c.capacity}명
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {formatUtcToLocal(c.recruit_start)} ~ {formatUtcToLocal(c.recruit_end)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setApplicantsCampaign(c)}
                        className="flex items-center gap-1 rounded-btn border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        <Users size={12} />
                        지원자 ({c.applicant_count})
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-gray-400 hover:text-danger-text"
                        title="캠페인 삭제"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={registerOpen} onClose={() => setRegisterOpen(false)} size="lg">
        <h3 className="font-semibold text-gray-800">캠페인 등록</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500">업체 선택</label>
            <select
              value={form.store_id}
              onChange={(e) => setForm({ ...form, store_id: e.target.value })}
              className="w-full rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
            >
              {stores.length === 0 && <option value="">등록된 매장 없음</option>}
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500">대표 이미지</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCampaignImage(e.target.files[0] ?? null)}
              className="block w-full text-xs text-gray-600 file:mr-2 file:rounded-btn file:border file:border-gray-300 file:bg-white file:px-2 file:py-1 file:text-xs file:text-gray-600"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500">캠페인 유형</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {CAMPAIGN_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, campaign_type: t })}
                  className={`rounded-btn border px-3 py-1 text-xs font-medium ${
                    form.campaign_type === t
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500">콘텐츠 유형</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, content_type: t })}
                  className={`rounded-btn border px-3 py-1 text-xs font-medium ${
                    form.content_type === t
                      ? 'border-brand-400 bg-brand-50 text-brand-700'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500">체험상품</label>
              <Input
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                placeholder="예: 순두부 백반 2인"
                className="w-full"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs text-gray-500">금액 (원)</label>
              <Input
                type="number"
                min="0"
                value={form.product_price}
                onChange={(e) => setForm({ ...form, product_price: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-500">모집 인원</label>
              <Input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500">메인키워드</label>
              <Input
                value={form.main_keyword}
                onChange={(e) => setForm({ ...form, main_keyword: e.target.value })}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500">서브키워드</label>
              <Input
                value={form.sub_keyword}
                onChange={(e) => setForm({ ...form, sub_keyword: e.target.value })}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500">가이드라인</label>
            <textarea
              value={form.content_guide}
              onChange={(e) => setForm({ ...form, content_guide: e.target.value })}
              rows={6}
              className="w-full rounded-btn border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500">방문 정보</p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="radio"
                  name="reservation_required"
                  checked={!form.reservation_required}
                  onChange={() => setForm({ ...form, reservation_required: false })}
                />
                예약 안 함
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="radio"
                  name="reservation_required"
                  checked={form.reservation_required}
                  onChange={() => setForm({ ...form, reservation_required: true })}
                />
                예약함
              </label>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500">담당자명</label>
                <Input
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  className="w-full"
                />
              </div>
              <div className="w-28">
                <label className="block text-xs text-gray-500">연락 방법</label>
                <select
                  value={form.contact_method}
                  onChange={(e) => setForm({ ...form, contact_method: e.target.value })}
                  className="w-full rounded-btn border border-gray-300 px-2 py-1 text-sm text-gray-900"
                >
                  {CONTACT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500">연락처</label>
                <Input
                  value={form.contact_info}
                  onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                  className="w-full"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500">추가 정보</label>
              <textarea
                value={form.extra_info}
                onChange={(e) => setForm({ ...form, extra_info: e.target.value })}
                rows={2}
                className="w-full rounded-btn border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500">캠페인 일정</p>
            <div>
              <label className="block text-xs text-gray-500">모집 게시일시</label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="datetime-local"
                  value={form.recruit_start}
                  onChange={(e) => setForm({ ...form, recruit_start: e.target.value })}
                />
                <span className="text-xs text-gray-400">~</span>
                <Input
                  type="datetime-local"
                  value={form.recruit_end}
                  onChange={(e) => setForm({ ...form, recruit_end: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500">리뷰 마감일</label>
              <Input
                type="date"
                value={form.review_deadline}
                onChange={(e) => setForm({ ...form, review_deadline: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={form.is_recurring}
                onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
              />
              정기 등록 사용 (모집 마감 후 자동 재등록은 아직 지원하지 않습니다 — 설정값만 저장)
            </label>
          </div>

          {error && <p className="text-xs text-danger-text">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>
              취소
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              등록
            </Button>
          </div>
        </form>
      </Modal>

      {applicantsCampaign && (
        <ExperienceApplicantsModal
          campaign={applicantsCampaign}
          onClose={() => setApplicantsCampaign(null)}
          onChanged={refresh}
        />
      )}
    </div>
  )
}

const APPLICATION_STATUS_LABEL = { pending: '대기중', approved: '승인됨', rejected: '거절됨' }
const APPLICATION_STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'danger' }

function ExperienceApplicantsModal({ campaign, onClose, onChanged }) {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      setApplications(await experienceCampaignApi.getApplications(campaign.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id])

  async function handleStatusChange(id, status) {
    try {
      await experienceCampaignApi.updateApplicationStatus(id, status)
      await refresh()
      await onChanged()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">
          {campaign.store_name} — 지원자 목록
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-brand-600">
          <X size={18} />
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
      {!loading && applications.length === 0 && (
        <p className="text-sm text-gray-400">아직 신청한 사람이 없습니다</p>
      )}

      <div className="space-y-2">
        {applications.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-card border border-gray-200 p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">{a.reviewer_name}</span>
                <Badge variant={APPLICATION_STATUS_VARIANT[a.status]}>
                  {APPLICATION_STATUS_LABEL[a.status]}
                </Badge>
              </div>
              <p className="text-xs text-gray-500">{a.reviewer_contact_info}</p>
              {a.reviewer_blog_url && (
                <a
                  href={a.reviewer_blog_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-600 hover:underline"
                >
                  {a.reviewer_blog_url}
                </a>
              )}
            </div>
            {a.status === 'pending' && (
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" variant="ghost" tone="emerald" onClick={() => handleStatusChange(a.id, 'approved')}>
                  승인
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleStatusChange(a.id, 'rejected')}>
                  거절
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}

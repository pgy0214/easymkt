import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { API_ORIGIN, productApi } from '../lib/api.js'
import Badge from './ui/Badge.jsx'
import Button from './ui/Button.jsx'
import Input from './ui/Input.jsx'
import Modal from './ui/Modal.jsx'

const EMPTY_PRODUCT = { name: '', display_order: 0, is_active: true }

export default function ProductManager() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [manageTarget, setManageTarget] = useState(null) // product being managed (thumbnail/detail images)
  const [uploadingThumb, setUploadingThumb] = useState(false)
  const [uploadingDetail, setUploadingDetail] = useState(false)
  const thumbInputRef = useRef(null)
  const detailInputRef = useRef(null)

  function refresh() {
    setLoading(true)
    productApi
      .list()
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  function replaceProduct(updated) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    setManageTarget((prev) => (prev && prev.id === updated.id ? updated : prev))
  }

  function openCreate() {
    setForm(EMPTY_PRODUCT)
    setFormError(null)
    setCreateOpen(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      const created = await productApi.create(form)
      setProducts((prev) => [created, ...prev])
      setCreateOpen(false)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(product) {
    try {
      const updated = await productApi.update(product.id, { is_active: !product.is_active })
      replaceProduct(updated)
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDelete(product) {
    if (!confirm(`"${product.name}" 상품을 삭제할까요?`)) return
    try {
      await productApi.delete(product.id)
      setProducts((prev) => prev.filter((p) => p.id !== product.id))
      setManageTarget((prev) => (prev?.id === product.id ? null : prev))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleThumbFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !manageTarget) return
    setUploadingThumb(true)
    try {
      replaceProduct(await productApi.uploadThumbnail(manageTarget.id, file))
    } catch (err) {
      alert(err.message)
    } finally {
      setUploadingThumb(false)
    }
  }

  async function handleDetailFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !manageTarget) return
    setUploadingDetail(true)
    try {
      replaceProduct(await productApi.addDetailImage(manageTarget.id, file))
    } catch (err) {
      alert(err.message)
    } finally {
      setUploadingDetail(false)
    }
  }

  async function handleRemoveDetailImage(imagePath) {
    try {
      replaceProduct(await productApi.removeDetailImage(manageTarget.id, imagePath))
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">불러오는 중...</p>
  if (error) return <p className="text-sm text-danger-text">{error}</p>

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900">마케팅 이렇게 하세요</h2>
          <p className="text-xs text-gray-400">
            마케팅 상품 설명 공간입니다.{' '}
            <span className="text-brand-600">(권장 크기: 썸네일 800×400px · 상세이미지 폭 900px 고정, 세로 길이 자유)</span>
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} className="mr-1 inline" />
          추가
        </Button>
      </div>

      {products.length === 0 && <p className="text-sm text-gray-400">등록된 상품이 없습니다.</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-card border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-800">{p.name}</span>
                <Badge variant={p.is_active ? 'success' : 'neutral'}>{p.is_active ? '노출중' : '숨김'}</Badge>
              </div>
            </div>
            {p.thumbnail_path ? (
              <img
                src={`${API_ORIGIN}${p.thumbnail_path}`}
                alt={p.name}
                className="mb-2 h-32 w-full rounded-btn object-cover"
              />
            ) : (
              <div className="mb-2 flex h-32 w-full items-center justify-center rounded-btn bg-gray-50 text-xs text-gray-400">
                썸네일 없음
              </div>
            )}
            <p className="mb-2 text-xs text-gray-400">상세이미지 {p.detail_image_paths.length}장</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setManageTarget(p)} className="text-xs text-brand-600 hover:underline">
                이미지 관리
              </button>
              <button onClick={() => handleToggleActive(p)} className="text-xs text-gray-500 hover:underline">
                {p.is_active ? '숨기기' : '노출하기'}
              </button>
              <button onClick={() => handleDelete(p)} className="text-xs text-danger-text hover:underline">
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)}>
        <h3 className="mb-3 font-semibold text-gray-800">추가</h3>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500">상품명</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">노출 순서</label>
            <Input
              type="number"
              value={form.display_order}
              onChange={(e) => setForm((prev) => ({ ...prev, display_order: Number(e.target.value) }))}
              className="w-full"
            />
          </div>
          <p className="text-xs text-gray-400">추가한 뒤 "이미지 관리"에서 썸네일/상세 이미지를 올려주세요.</p>
          {formError && <p className="text-sm text-danger-text">{formError}</p>}
          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            {submitting ? '저장 중...' : '저장'}
          </Button>
        </form>
      </Modal>

      <Modal open={!!manageTarget} onClose={() => setManageTarget(null)}>
        {manageTarget && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-800">{manageTarget.name} — 이미지 관리</h3>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">썸네일 (카드 목록용)</p>
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleThumbFileChange}
              />
              {manageTarget.thumbnail_path && (
                <img
                  src={`${API_ORIGIN}${manageTarget.thumbnail_path}`}
                  alt=""
                  className="mb-2 h-24 w-full rounded-btn object-cover"
                />
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={uploadingThumb}
                onClick={() => thumbInputRef.current?.click()}
              >
                {uploadingThumb ? '업로드 중...' : '썸네일 업로드'}
              </Button>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">
                상세 이미지 (업로드한 순서대로 상세페이지에 이어붙여집니다)
              </p>
              <input
                ref={detailInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleDetailFileChange}
              />
              <div className="mb-2 space-y-2">
                {manageTarget.detail_image_paths.map((path) => (
                  <div key={path} className="relative">
                    <img src={`${API_ORIGIN}${path}`} alt="" className="w-full rounded-btn object-cover" />
                    <button
                      onClick={() => handleRemoveDetailImage(path)}
                      className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-gray-600 hover:bg-white"
                      title="삭제"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {manageTarget.detail_image_paths.length === 0 && (
                  <p className="text-xs text-gray-400">등록된 상세 이미지가 없습니다.</p>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={uploadingDetail}
                onClick={() => detailInputRef.current?.click()}
              >
                {uploadingDetail ? '업로드 중...' : '상세 이미지 추가'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

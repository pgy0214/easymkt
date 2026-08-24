import { Download, Play, Square, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import Badge from './ui/Badge.jsx'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'

const TEMPLATE_HEADERS = ['마이플레이스링크', '비고']
const POLL_INTERVAL_MS = 1500

function csvCell(value) {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadCsv(filename, rows) {
  // leading BOM so Excel opens the Korean headers as UTF-8 instead of guessing ANSI
  const csv = '﻿' + rows.map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadTemplate() {
  downloadCsv('블라인드_일괄확인_양식.csv', [TEMPLATE_HEADERS])
}

function downloadResults(results) {
  const rows = [['매장명', '마이플레이스링크', '비고', '영수증날짜', '결과']]
  for (const r of results) {
    const resultText = r.error ? `확인실패: ${r.error}` : r.is_blinded ? '블라인드' : '정상노출'
    rows.push([r.store_name, r.profile_url, r.note || '', r.review_date || '', resultText])
  }
  downloadCsv('블라인드_일괄확인_결과.csv', rows)
}

export default function BlindBulkCheckPanel() {
  const fileInputRef = useRef(null)
  const pollRef = useRef(null)
  const [stores, setStores] = useState([])
  const [storeId, setStoreId] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [liveView, setLiveView] = useState(false)
  const [job, setJob] = useState(null) // {job_id, status, total, processed, results}
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getStores().then(setStores).catch((err) => setError(err.message))
  }, [])

  useEffect(() => () => clearInterval(pollRef.current), [])

  function pollJob(jobId) {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getBulkBlindCheckJob(jobId)
        setJob(data)
        if (data.status !== 'running') {
          clearInterval(pollRef.current)
          setCancelling(false)
        }
      } catch (err) {
        clearInterval(pollRef.current)
        setError(err.message)
        setCancelling(false)
      }
    }, POLL_INTERVAL_MS)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setJob(null)
    setSelectedFile(file)
  }

  async function handleStart() {
    if (!storeId || !selectedFile) return
    setError(null)
    setJob(null)
    try {
      const { job_id, total } = await api.startBulkBlindCheck(selectedFile, storeId, liveView)
      setJob({ job_id, status: 'running', total, processed: 0, results: [] })
      pollJob(job_id)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleCancel() {
    if (!job) return
    setCancelling(true)
    try {
      await api.cancelBulkBlindCheckJob(job.job_id)
    } catch (err) {
      setError(err.message)
      setCancelling(false)
    }
  }

  const checking = job?.status === 'running'
  const results = job?.results ?? []
  const blindedCount = results.filter((r) => r.is_blinded).length
  const errorCount = results.filter((r) => r.error).length

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-semibold text-gray-800">블라인드 일괄확인 (엑셀)</h3>
        <p className="text-xs text-gray-400">
          이 프로그램에 등록되지 않은 과거/외부 캠페인도 확인할 수 있습니다. 아래에서 매장을
          고르고 마이플레이스링크가 담긴 파일을 올리면, 그 매장의 지금 리뷰 목록에서 각 링크의
          작성자를 찾아 블라인드 여부를 판정합니다 (닉네임이 바뀌어도 링크의 고유 id로
          매칭하므로 정확합니다).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-gray-500">매장</label>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            disabled={checking}
            className="rounded-btn border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          >
            <option value="">매장 선택</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => fileInputRef.current?.click()} disabled={checking} variant="secondary">
          <Upload size={14} />
          {selectedFile ? selectedFile.name : '엑셀/CSV 선택'}
        </Button>
        <Button onClick={downloadTemplate} variant="outline">
          <Download size={14} />
          샘플 양식 다운로드
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFile} />
        <label className="flex items-center gap-1 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={liveView}
            onChange={(e) => setLiveView(e.target.checked)}
            disabled={checking}
          />
          실시간 화면 보기
        </label>
        {!checking ? (
          <Button onClick={handleStart} disabled={!storeId || !selectedFile} variant="primary">
            <Play size={14} />
            크롤링 시작하기
          </Button>
        ) : (
          <Button onClick={handleCancel} disabled={cancelling} variant="danger">
            <Square size={14} />
            {cancelling ? '중단 중...' : '중단'}
          </Button>
        )}
        {results.length > 0 && (
          <Button onClick={() => downloadResults(results)} variant="outline">
            <Download size={14} />
            결과 다운로드
          </Button>
        )}
      </div>

      {liveView && (
        <p className="text-xs text-amber-600">
          실시간 화면 보기가 켜져 있으면 서버 PC에 실제 크롬 창이 떠서 확인 과정을 볼 수 있어요.
          네이버 보안 확인(캡차) 화면이 뜨면 창이 바로 안 닫히고 최대 3분간 기다리니, 그 사이에
          직접 정답을 입력해서 풀어주시면 이어서 진행됩니다. 평소엔 꺼두는 걸 권장해요.
        </p>
      )}

      {job && (
        <span className="block text-xs text-gray-600">
          {checking
            ? `${job.processed}/${job.total}건 처리 중...`
            : `총 ${results.length}건 · 블라인드 ${blindedCount}건${errorCount > 0 ? ` · 확인실패 ${errorCount}건` : ''}${job.status === 'cancelled' ? ' · 중단됨' : ''}`}
        </span>
      )}
      {error && <p className="text-sm text-danger-text">{error}</p>}
      {checking && (
        <p className="text-sm text-gray-400">
          매장 리뷰를 스크래핑하고 있어요. 리뷰 개수에 따라 몇 분 걸릴 수 있습니다. 중단해도
          지금까지 확인된 결과는 아래에 남습니다.
        </p>
      )}
      {results.length > 0 && (
        <div className="max-h-96 overflow-auto rounded-btn border border-gray-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">매장명</th>
                <th className="px-3 py-2 text-left">마이플레이스링크</th>
                <th className="px-3 py-2 text-left">비고</th>
                <th className="px-3 py-2 text-left">영수증날짜</th>
                <th className="px-3 py-2 text-left">결과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r) => (
                <tr key={r.row_index}>
                  <td className="px-3 py-2 text-gray-600">{r.store_name}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-gray-600" title={r.profile_url}>
                    {r.profile_url}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{r.note || '-'}</td>
                  <td className="px-3 py-2 text-gray-500">{r.review_date || '-'}</td>
                  <td className="px-3 py-2">
                    {r.error ? (
                      <Badge variant="neutral">확인실패: {r.error}</Badge>
                    ) : r.is_blinded ? (
                      <Badge variant="danger">블라인드</Badge>
                    ) : (
                      <Badge variant="success">정상노출</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

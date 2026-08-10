import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { api } from '../lib/api.js'
import Badge from './ui/Badge.jsx'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'

const TEMPLATE_HEADERS = ['매장URL', '마이플레이스링크', '비고']

function downloadTemplate() {
  // leading BOM so Excel opens the Korean headers as UTF-8 instead of guessing ANSI
  const csv = '﻿' + TEMPLATE_HEADERS.join(',') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '블라인드_일괄확인_양식.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function BlindBulkCheckPanel() {
  const fileInputRef = useRef(null)
  const [checking, setChecking] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setChecking(true)
    setError(null)
    setResults(null)
    try {
      setResults(await api.bulkBlindCheck(file))
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  const blindedCount = results?.filter((r) => r.is_blinded).length ?? 0
  const errorCount = results?.filter((r) => r.error).length ?? 0

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-semibold text-gray-800">블라인드 일괄확인 (엑셀)</h3>
        <p className="text-xs text-gray-400">
          이 프로그램에 등록되지 않은 과거/외부 캠페인도 확인할 수 있습니다. 매장URL과
          마이플레이스링크가 있는 행마다 그 매장의 지금 리뷰 목록에서 해당 사용자를 찾아
          블라인드 여부를 판정합니다 (닉네임이 바뀌어도 링크의 고유 id로 매칭하므로 정확합니다).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => fileInputRef.current?.click()} disabled={checking} variant="secondary">
          <Upload size={14} />
          {checking ? '확인 중...' : '엑셀/CSV 업로드'}
        </Button>
        <Button onClick={downloadTemplate} variant="outline">
          <Download size={14} />
          샘플 양식 다운로드
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFile} />
        {results && (
          <span className="text-xs text-gray-600">
            총 {results.length}건 · 블라인드 {blindedCount}건
            {errorCount > 0 && ` · 확인실패 ${errorCount}건`}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-danger-text">{error}</p>}
      {checking && (
        <p className="text-sm text-gray-400">
          매장별로 리뷰를 스크래핑하고 있어요. 매장 수와 리뷰 개수에 따라 몇 분 걸릴 수 있습니다...
        </p>
      )}
      {results && results.length > 0 && (
        <div className="max-h-96 overflow-auto rounded-btn border border-gray-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">매장URL</th>
                <th className="px-3 py-2 text-left">마이플레이스링크</th>
                <th className="px-3 py-2 text-left">비고</th>
                <th className="px-3 py-2 text-left">결과</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r) => (
                <tr key={r.row_index}>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-gray-600" title={r.store_url}>
                    {r.store_url}
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-gray-600" title={r.profile_url}>
                    {r.profile_url}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{r.note || '-'}</td>
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

import { AlertTriangle } from 'lucide-react'

const RULES = [
  {
    title: '동일 날짜 작업 금지',
    important: true,
    body: '모든 작업은 1계정당 1일에 1건만 진행합니다. 예: 9/25 영수증으로 리뷰 작업을 했다면, 같은 계정으로 9/25 날짜의 다른 작업은 하지 않습니다.',
  },
  {
    title: '영수증 캡쳐',
    important: true,
    body: '영수증은 반드시 영수증 부분만 캡쳐해서 사용하세요. 카카오톡으로 전달받은 원본 이미지를 그대로 첨부하는 것은 절대 금지입니다.',
  },
  {
    title: '다계정 작업 시 비행기모드',
    important: true,
    body: '다음 계정으로 작업을 전환할 때는 반드시 비행기모드를 켰다 끈 뒤 로그인하세요. (비행기모드를 켠 상태에서 작업하는 것이 아니라, 계정 전환 시에만 활용합니다)',
  },
  {
    title: '영수증 시간 입력',
    important: false,
    body: '리뷰 작성 시 시간을 입력해야 하는 경우, 실제 영수증에 찍힌 시간을 그대로 입력합니다.',
  },
  {
    title: '작업 계정 확인',
    important: false,
    body: '전달받은 영수증·링크와 실제 작업할 계정 닉네임이 맞는지 반드시 확인한 뒤 작업합니다. 모든 영수증은 그 계정에 맞춰 전송됩니다.',
  },
  {
    title: '사진 오류 시',
    important: false,
    body: '전달받은 사진을 리뷰에 그대로 쓸 수 없는 상태(깨지거나 이상하게 나온 경우)라면, 화면을 캡쳐해서 대신 사용하세요.',
  },
]

export default function WorkRulesModal({ onClose, onAcknowledge }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900">작업 필수 수칙</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          아래 수칙을 꼭 확인하고 작업해주세요. 위반 시 작업이 무효 처리될 수 있습니다.
        </p>

        <div className="mt-4 space-y-3">
          {RULES.map((rule, i) => (
            <div
              key={rule.title}
              className={`rounded-lg border p-3 ${
                rule.important ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400">{i + 1}</span>
                <span className="text-sm font-semibold text-slate-800">{rule.title}</span>
                {rule.important && (
                  <span className="ml-auto flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                    <AlertTriangle size={10} />
                    매우중요
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{rule.body}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onAcknowledge}
          className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          확인했습니다
        </button>
      </div>
    </div>
  )
}

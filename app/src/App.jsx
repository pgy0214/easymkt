// 네이티브 앱(안드로이드)에서는 capacitor.config.json의 server.url이 실행홈피를 직접
// 로드하므로 이 화면은 안 보임. 이 화면은 `npm run dev`로 브라우저에서 미리볼 때만 쓰임.
const EXECUTION_SITE_URL = 'https://review.ezmkt.co.kr/portal'

export default function App() {
  return (
    <iframe
      title="실행홈피"
      src={EXECUTION_SITE_URL}
      style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
    />
  )
}

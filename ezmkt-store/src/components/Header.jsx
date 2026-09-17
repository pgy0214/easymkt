import { navigate } from '../App.jsx'

export default function Header() {
  return (
    <header className="border-b border-gray-100">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <button onClick={() => navigate('/')} className="text-lg font-bold text-gray-900">
          이지스토어
        </button>
      </div>
    </header>
  )
}

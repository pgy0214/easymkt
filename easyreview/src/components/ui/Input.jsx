const BASE =
  'rounded-btn border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

export default function Input({ label, className = '', ...props }) {
  if (!label) {
    return <input className={`${BASE} ${className}`} {...props} />
  }

  return (
    <label className="block w-full text-sm text-gray-700">
      {label}
      <input className={`mt-1 w-full ${BASE} ${className}`} {...props} />
    </label>
  )
}

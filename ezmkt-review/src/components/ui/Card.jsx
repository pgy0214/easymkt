const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
}

export default function Card({ padding = 'md', overflow, className = '', children }) {
  return (
    <div
      className={`rounded-card border border-gray-200 bg-white ${overflow === 'hidden' ? 'overflow-hidden' : ''} ${PADDING[padding]} ${className}`}
    >
      {children}
    </div>
  )
}

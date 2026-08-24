const SIZE = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-1.5 text-sm',
}

const VARIANT = {
  primary: 'bg-brand-500 font-semibold text-white hover:bg-brand-600 active:bg-brand-700',
  secondary: 'bg-gray-800 font-semibold text-white hover:bg-gray-700',
  outline: 'border border-gray-300 font-medium text-gray-700 hover:bg-gray-50',
  danger: 'bg-danger-text font-semibold text-white hover:opacity-90',
  ghost: {
    blue: 'border border-brand-200 bg-brand-50 font-medium text-brand-700 hover:bg-brand-100',
    emerald: 'border border-emerald-200 bg-emerald-50 font-medium text-emerald-700 hover:bg-emerald-100',
  },
  icon: 'p-1 text-gray-400 hover:text-brand-600',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  tone = 'blue',
  as: Comp = 'button',
  className = '',
  disabled,
  ...props
}) {
  if (variant === 'icon') {
    return (
      <Comp
        className={`inline-flex items-center transition-colors ${VARIANT.icon} disabled:pointer-events-none disabled:opacity-40 ${className}`}
        disabled={disabled}
        {...props}
      />
    )
  }

  const variantClass = variant === 'ghost' ? VARIANT.ghost[tone] : VARIANT[variant]

  return (
    <Comp
      className={`inline-flex items-center justify-center gap-1 rounded-pill transition-colors disabled:pointer-events-none disabled:opacity-50 ${SIZE[size]} ${variantClass} ${className}`}
      disabled={disabled}
      {...props}
    />
  )
}

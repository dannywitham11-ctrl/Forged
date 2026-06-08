export default function StarRating({
  value, onChange, size = 18, readonly = false,
}: { value: number | null; onChange?: (v: number | null) => void; size?: number; readonly?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => {
        const filled = (value || 0) >= n
        return (
          <button
            key={n}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(value === n ? null : n)}
            className={`${readonly ? '' : 'hover:scale-110'} transition-transform`}
            title={`${n} star${n > 1 ? 's' : ''}`}
          >
            <svg width={size} height={size} viewBox="0 0 24 24"
              fill={filled ? '#f5b84a' : 'none'} stroke={filled ? '#f5b84a' : '#7b8aa8'} strokeWidth="1.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        )
      })}
    </div>
  )
}

import { clsx } from 'clsx'
import { useState, useEffect, useRef } from 'react'

function useRoll(value) {
  const prev = useRef(value)
  const [key, setKey] = useState(0)
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setKey(k => k + 1)
  }, [value])
  return key
}

export function Card({ children, className, style }) {
  return (
    <div className={clsx('w3-card p-4', className)} style={style}>
      {children}
    </div>
  )
}

// 赛博朋克风格 Loading — 扫描条 + 闪烁标签 + 闪烁光标
export function CyberLoader({ label = 'LOADING', meta, className, style }) {
  return (
    <div className={clsx('cyber-loader', className)} style={style}>
      <div className="cyber-loader-frame">
        <div className="cyber-loader-bar" />
        <div className="cyber-loader-row">
          <span className="cyber-loader-bracket">«</span>
          <span className="cyber-loader-label">
            {label}
            <span className="cyber-loader-dot" />
          </span>
          <span className="cyber-loader-bracket">»</span>
        </div>
      </div>
      {meta && (
        <div className="cyber-loader-meta">
          {meta}<span className="cyber-loader-meta-blink" />
        </div>
      )}
    </div>
  )
}

export function Badge({ children, color = 'blue' }) {
  const colors = {
    blue:   'bg-accent-green/10 text-accent-green border-accent-green/30',
    green:  'bg-accent-green/10 text-accent-green border-accent-green/30',
    red:    'bg-accent-red/10 text-accent-red border-accent-red/30',
    yellow: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30',
    purple: 'bg-accent-purple/10 text-accent-purple border-accent-purple/30',
    gray:   'bg-dark-600 text-gray-400 border-dark-500',
  }
  return (
    <span className={clsx('text-xs px-2 py-0.5 rounded border font-mono tracking-wide', colors[color])}>
      {children}
    </span>
  )
}

export function PnlValue({ value, suffix = 'U' }) {
  const isPos = value >= 0
  return (
    <span className={clsx('font-mono', isPos ? 'pnl-positive' : 'pnl-negative')}>
      {isPos ? '+' : ''}{typeof value === 'number' ? value.toFixed(4) : value}{suffix}
    </span>
  )
}

export function Button({ children, onClick, disabled, variant = 'primary', className, size = 'md' }) {
  const variants = {
    primary: 'bg-accent-green/15 hover:bg-accent-green/25 text-accent-green border border-accent-green/40 hover:border-accent-green/70 hover:shadow-[0_0_12px_#00ff8730]',
    danger:  'bg-accent-red/15 hover:bg-accent-red/25 text-accent-red border border-accent-red/40 hover:border-accent-red/70 hover:shadow-[0_0_12px_#ff2d5530]',
    ghost:   'bg-dark-700 hover:bg-dark-600 text-gray-400 border border-dark-500 hover:border-dark-400',
    success: 'bg-accent-green/15 hover:bg-accent-green/25 text-accent-green border border-accent-green/40 hover:border-accent-green/70 hover:shadow-[0_0_12px_#00ff8730]',
  }
  const sizes = { sm: 'px-3 py-1 text-xs', md: 'px-4 py-1.5 text-sm', lg: 'px-6 py-2.5 text-base' }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'cp-btn font-mono font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed tracking-wide',
        variant === 'danger' && 'cp-btn-magenta',
        variants[variant], sizes[size], className
      )}
    >
      {children}
    </button>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative w-11 h-5 rounded-full transition-all border',
          checked
            ? 'bg-accent-green/20 border-accent-green/50 shadow-[0_0_8px_#00ffaa30]'
            : 'bg-dark-600 border-dark-500'
        )}
      >
        <div className={clsx(
          'absolute top-0.5 w-4 h-4 rounded-full transition-all shadow',
          checked ? 'left-6 bg-accent-green shadow-[0_0_6px_#00ffaa]' : 'left-0.5 bg-gray-500'
        )} />
      </div>
      {label && <span className="text-xs font-mono text-gray-400 tracking-wide">{label}</span>}
    </label>
  )
}

export function StatCard({ label, value, sub, color = 'white', index = 0, winRate }) {
  const colors = {
    white:  'text-white',
    green:  'text-accent-green',
    red:    'text-accent-red',
    yellow: 'text-accent-yellow',
  }
  const rollKey = useRoll(value)
  return (
    <Card className="stat-enter" style={{ animationDelay: `${index * 80}ms` }}>
      <div className="text-xs text-gray-600 mb-1 font-mono tracking-widest uppercase">{label}</div>
      <div key={rollKey} className={clsx('text-2xl font-bold font-mono count-roll', colors[color])}>{value}</div>
      {winRate != null ? (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-600 mb-0.5 font-mono">
            <span>WIN</span><span className="text-gray-500">{winRate}%</span>
          </div>
          <div className="h-px bg-dark-500 rounded-full overflow-hidden">
            <div
              key={rollKey}
              className="h-full rounded-full bar-fill"
              style={{
                width: `${Math.min(winRate, 100)}%`,
                backgroundColor: winRate >= 50 ? '#00ffaa' : winRate >= 30 ? '#ffcc00' : '#ff3366',
                boxShadow: `0 0 6px ${winRate >= 50 ? '#00ffaa' : winRate >= 30 ? '#ffcc00' : '#ff3366'}`,
                animationDelay: `${index * 80 + 200}ms`,
              }}
            />
          </div>
        </div>
      ) : sub ? (
        <div className="text-xs text-gray-600 mt-1 font-mono">{sub}</div>
      ) : null}
    </Card>
  )
}

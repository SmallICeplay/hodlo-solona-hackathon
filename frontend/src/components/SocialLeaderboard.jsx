import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'
import FollowModal from './FollowModal'
import CallerDetailPage from './CallerDetailPage'
import { Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { MemeGaugeLarge } from '../App'
import { CyberLoader } from './UI'
import { callerName } from '../callerName'

const API_URL = '/api/analytics/leaderboard_proxy'
const HISTORY_URL = '/api/analytics/leaderboard_history'

const CHAIN_CFG = {
  bsc:     { label: 'BSC',  color: 'text-yellow-400 bg-yellow-900/20 border-yellow-700/30' },
  solana:  { label: 'SOL',  color: 'text-purple-400 bg-purple-900/20 border-purple-700/30' },
  eth:     { label: 'ETH',  color: 'text-blue-400 bg-blue-900/20 border-blue-700/30' },
  base:    { label: 'BASE', color: 'text-sky-400 bg-sky-900/20 border-sky-700/30' },
  unknown: { label: '?',    color: 'text-gray-500 bg-dark-700/20 border-dark-500' },
}

// 简单字符串 hash → 数字
function strHash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0
  }
  return Math.abs(h)
}

// 5×5 像素风 Identicon（类 GitHub）
function Identicon({ seed, size = 36 }) {
  const grid = useMemo(() => {
    const h = strHash(seed || '?')
    // 用 hash 派生颜色（HSL，饱和度/亮度固定范围保证可见）
    const hue = h % 360
    const sat = 55 + (h >> 8) % 30   // 55–84
    const lit = 45 + (h >> 16) % 20  // 45–64
    const color = `hsl(${hue},${sat}%,${lit}%)`
    const bg = `hsl(${hue},15%,14%)`
    // 5×5 格子，左右镜像（只用左侧3列 hash 决定是否填充）
    const cells = []
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const bit = (h >> (row * 3 + col)) & 1
        cells.push({ row, col, filled: bit === 1 })
        if (col < 2) cells.push({ row, col: 4 - col, filled: bit === 1 })
      }
    }
    return { cells, color, bg }
  }, [seed])

  const cell = size / 5
  return (
    <svg width={size} height={size} style={{ borderRadius: '50%', display: 'block', flexShrink: 0 }}>
      <rect width={size} height={size} fill={grid.bg} />
      {grid.cells.map((c, i) => c.filled && (
        <rect key={i}
          x={c.col * cell} y={c.row * cell}
          width={cell} height={cell}
          fill={grid.color} />
      ))}
    </svg>
  )
}

// 7日收益率曲线 SVG
function Sparkline({ points }) {
  // points: [{date, avg_mult}, ...]，最多7个
  if (!points || points.length < 2) {
    return <span className="text-gray-600 text-xs">—</span>
  }
  const vals = points.map(p => p.avg_mult * 100)  // avg_mult 本身就是收益率倍数（如1.69=169%）
  const min = Math.min(...vals, 0)
  const max = Math.max(...vals, 0)
  const range = max - min || 1
  const W = 64, H = 28, pad = 3
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v - min) / range) * (H - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = vals[vals.length - 1]
  const first = vals[0]
  const up = last >= first
  // 零基准线 y 坐标
  const zeroY = H - pad - ((0 - min) / range) * (H - pad * 2)
  return (
    <svg width={W} height={H} className="overflow-visible">
      <line x1={pad} y1={zeroY.toFixed(1)} x2={W - pad} y2={zeroY.toFixed(1)}
        stroke="#374151" strokeWidth="0.5" strokeDasharray="2,2" />
      <polyline points={pts} fill="none"
        stroke={up ? '#4ade80' : '#f87171'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={(pad + (vals.length - 1) / (vals.length - 1) * (W - pad * 2)).toFixed(1)}
        cy={pts.split(' ').pop().split(',')[1]}
        r="2" fill={up ? '#4ade80' : '#f87171'} />
    </svg>
  )
}

// 7日收益率单元格
function SevenDayReturn({ history }) {
  if (!history || history.length === 0) {
    return <span className="text-gray-600 text-xs">暂无</span>
  }
  // 用最近7条（可能不满7条）
  const recent = history.slice(-7)
  // avg_mult = total_multiplier/ca_count，本身就是百分比收益率（如1.69=169%）
  // 7日收益率取各日均值
  const avgPct = recent.reduce((acc, d) => acc + d.avg_mult * 100, 0) / recent.length
  const color = avgPct >= 100 ? 'text-yellow-300' : avgPct >= 30 ? 'text-green-400' : avgPct >= 0 ? 'text-green-600' : 'text-red-400'
  return (
    <div className="text-center">
      <div className={clsx('text-base font-bold tabular-nums font-mono', color)}>
        {avgPct >= 0 ? '+' : ''}{avgPct.toFixed(1)}%
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{recent.length}日均值</div>
    </div>
  )
}

function parseRate(s) {
  if (!s) return 0
  return parseFloat(String(s).replace('%', '')) || 0
}

function getGrade(wr, calls) {
  if (wr >= 70 && calls >= 20) return 'S'
  if (wr >= 60) return 'A'
  if (wr >= 45) return 'B'
  return 'C'
}

const GRADE_COLOR = {
  S: 'text-yellow-300 bg-yellow-900/30 border-yellow-600/40 shadow-[0_0_6px_#fde04760]',
  A: 'text-green-300 bg-green-900/30 border-green-600/40 shadow-[0_0_6px_#4ade8060]',
  B: 'text-blue-300  bg-blue-900/30  border-blue-600/40',
  C: 'text-gray-400  bg-dark-700/30  border-dark-500',
}

// 胜率进度条
function WinRateBar({ rate, today }) {
  const { t } = useTranslation()
  const color = rate >= 60 ? 'bg-green-500' : rate >= 45 ? 'bg-yellow-500' : 'bg-red-500'
  const todayColor = today >= 60 ? 'text-green-400' : today >= 45 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="flex flex-col gap-1 min-w-[80px]">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex-1 h-2 bg-dark-700 rounded-full overflow-hidden">
          <div className={clsx('h-full rounded-full', color)} style={{ width: `${Math.min(rate, 100)}%` }} />
        </div>
        <span className={clsx('text-sm font-bold tabular-nums', rate >= 60 ? 'text-green-400' : rate >= 45 ? 'text-yellow-400' : 'text-red-400')}>
          {rate.toFixed(0)}%
        </span>
      </div>
      <div className="text-xs text-gray-500">
        {t('leaderboard.row.today_label')} <span className={clsx('font-mono font-medium', todayColor)}>{today.toFixed(0)}%</span>
      </div>
    </div>
  )
}

// 最近代币 chips（含单币涨幅）
function RecentTokens({ records }) {
  if (!records?.length) return <span className="text-gray-600 text-sm">—</span>
  const seen = new Set()
  const unique = records.filter(r => {
    const k = r.token
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 4)

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {unique.map((r, i) => {
        const mult = r.multiplier ?? 0
        const pct = mult * 100
        const pctColor = pct >= 100 ? 'text-yellow-300' : pct >= 20 ? 'text-green-400' : pct >= 0 ? 'text-green-600' : 'text-red-400'
        return (
          <div key={i} className="flex items-center gap-1 bg-dark-700/40 rounded px-1.5 py-0.5">
            <span className="text-xs text-gray-300 font-mono max-w-[56px] truncate">{r.symbol || r.token?.slice(0, 6)}</span>
            <span className={clsx('text-xs font-bold font-mono', pctColor)}>{pct >= 0 ? '+' : ''}{pct.toFixed(0)}%</span>
          </div>
        )
      })}
    </div>
  )
}

// 展开面板
function ExpandedPanel({ item }) {
  const { t } = useTranslation()
  const todayWr = parseRate(item.today_win_rate)
  const todayWrColor = todayWr >= 60 ? '#5dffb0' : todayWr >= 45 ? '#fbbf24' : '#ff7d97'

  const records = item.records || []
  const TOKENS_PER_PAGE = 18
  const totalPages = Math.max(1, Math.ceil(records.length / TOKENS_PER_PAGE))
  const [tokenPage, setTokenPage] = useState(0)
  const pageRecords = records.slice(tokenPage * TOKENS_PER_PAGE, (tokenPage + 1) * TOKENS_PER_PAGE)

  return (
    <div className="cp-expanded px-5 py-5 space-y-5">
      {/* 今日喊单代币列表 */}
      {records.length > 0 && (
        <div>
          <div className="cp-section-label flex items-center justify-between !mb-2">
            <span className="inline-flex items-center gap-2">
              {t('leaderboard.expanded.today_tokens')}
              <span className="cp-section-count">[ {t('leaderboard.expanded.today_tokens_count', { n: records.length })} ]</span>
            </span>
            {totalPages > 1 && (
              <span className="inline-flex items-center gap-2 normal-case tracking-normal">
                <button
                  disabled={tokenPage <= 0}
                  onClick={() => setTokenPage(p => Math.max(0, p - 1))}
                  className="px-2 py-0.5 text-[12px] font-mono font-bold text-accent-green border border-accent-green/40 hover:border-accent-green hover:bg-accent-green/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ clipPath: 'polygon(3px 0, 100% 0, calc(100% - 3px) 100%, 0 100%)' }}
                >←</button>
                <span className="text-[12px] font-mono font-bold text-accent-green/80 tabular-nums">
                  {tokenPage + 1}/{totalPages}
                </span>
                <button
                  disabled={tokenPage >= totalPages - 1}
                  onClick={() => setTokenPage(p => Math.min(totalPages - 1, p + 1))}
                  className="px-2 py-0.5 text-[12px] font-mono font-bold text-accent-green border border-accent-green/40 hover:border-accent-green hover:bg-accent-green/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ clipPath: 'polygon(3px 0, 100% 0, calc(100% - 3px) 100%, 0 100%)' }}
                >→</button>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 overflow-y-auto pr-1" style={{ maxHeight: '180px' }}>
            {pageRecords.map((r, i) => {
              const chain = CHAIN_CFG[(r.chain || '').toLowerCase()] || CHAIN_CFG.unknown
              return (
                <div key={tokenPage * TOKENS_PER_PAGE + i} className="cp-token-chip">
                  <span className={clsx('text-[11px] font-bold px-1.5 py-0.5 rounded border', chain.color)}>{chain.label}</span>
                  <span className="text-sm text-gray-100 font-mono font-semibold max-w-[88px] truncate" title={r.token}>{r.symbol || r.token?.slice(0, 8)}</span>
                  <span className="text-xs text-gray-500 font-mono">·{r.token?.slice(-4)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 统计对比 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 今日表现 */}
        <div className="cp-stat-panel">
          <div className="cp-section-label">{t('leaderboard.expanded.today_perf')}</div>
          <div className="space-y-0.5">
            <div className="cp-stat-row">
              <span className="cp-stat-key">{t('leaderboard.expanded.calls')}</span>
              <span className="cp-stat-val text-gray-100">{item.ca_count}</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-key">{t('leaderboard.expanded.pumped')}</span>
              <span className="cp-stat-val" style={{ color: '#5dffb0' }}>{item.rise_count}</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-key">{t('leaderboard.expanded.wins')}</span>
              <span className="cp-stat-val" style={{ color: '#5dffb0' }}>{item.win_count}</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-key">{t('leaderboard.expanded.today_winrate')}</span>
              <span className="cp-stat-val" style={{ color: todayWrColor }}>{item.today_win_rate}</span>
            </div>
          </div>
        </div>

        {/* 历史战绩 */}
        <div className="cp-stat-panel">
          <div className="cp-section-label">{t('leaderboard.expanded.all_time_stats')}</div>
          <div className="space-y-0.5">
            <div className="cp-stat-row">
              <span className="cp-stat-key">{t('leaderboard.expanded.total_calls')}</span>
              <span className="cp-stat-val text-gray-100">{item.total_ca_count}</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-key">{t('leaderboard.expanded.wins')}</span>
              <span className="cp-stat-val" style={{ color: '#5dffb0' }}>{item.total_win_count}</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-key">{t('leaderboard.expanded.winrate')}</span>
              <span className="cp-stat-val" style={{ color: '#5dffb0' }}>{item.win_rate}</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-key">{t('leaderboard.expanded.total_mult')}</span>
              <span className="cp-stat-val" style={{ color: '#fbbf24' }}>{item.total_multiplier?.toFixed(2)}x</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PersonRow({ item, expanded, onToggle, history, onFollowClick, onDetailClick, isFollowing, isSelected }) {
  const { t, i18n } = useTranslation()
  const totalWr = parseRate(item.win_rate)
  const todayWr = parseRate(item.today_win_rate)
  const g = getGrade(totalWr, item.total_ca_count)
  const todayMult = item.total_multiplier || 0
  const sevenMult = item.total_multiplier_7d || 0
  const avgTodayPct = item.ca_count > 0 ? (todayMult / item.ca_count) * 100 : null

  const rank = item.rank
  const rankNode = rank === 1
    ? <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-black bg-gradient-to-b from-yellow-300 to-amber-500 text-black shadow-[0_0_10px_#fbbf24]">1</span>
    : rank === 2
    ? <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-black bg-gradient-to-b from-gray-200 to-gray-400 text-black shadow-[0_0_6px_#9ca3af]">2</span>
    : rank === 3
    ? <span className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-black bg-gradient-to-b from-orange-300 to-orange-600 text-black shadow-[0_0_6px_#f97316]">3</span>
    : <span className="text-sm text-gray-600 tabular-nums font-mono">{rank}</span>

  // ── 移动端卡片布局 ────────────────────────────────────────────
  const pctColor = avgTodayPct === null ? 'text-gray-600'
    : avgTodayPct >= 50 ? 'text-yellow-300' : avgTodayPct >= 20 ? 'text-green-400'
    : avgTodayPct >= 0 ? 'text-green-600' : 'text-red-400'
  const wrColor    = totalWr >= 60 ? 'text-green-400' : totalWr >= 45 ? 'text-yellow-400' : 'text-red-400'
  const wrBarColor = totalWr >= 60 ? 'bg-accent-green' : totalWr >= 45 ? 'bg-accent-yellow' : 'bg-accent-red'

  const MobileCard = () => (
    <div
      className={clsx('border-b border-dark-600/50 px-3 py-3 border-l-2 transition-colors',
        isSelected ? 'border-l-accent-green bg-accent-green/5' :
        expanded ? 'neon-row-active' : 'border-l-transparent active:bg-white/[0.02]'
      )}
      onClick={() => onDetailClick(item)}
    >
      <div className="flex items-center gap-2.5">
        {/* 排名 */}
        <div className="w-5 text-center shrink-0 text-sm text-gray-500 tabular-nums">
          {rank <= 3 ? <span className="text-base">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span> : rank}
        </div>

        {/* 头像 */}
        <Identicon seed={item.qy_wxid} size={36} />

        {/* 中间主信息 */}
        <div className="flex-1 min-w-0">
          {/* 名字 + 等级 */}
          <div className="flex items-center gap-1 mb-1.5">
            <span className={clsx('text-[10px] font-bold px-1 py-px rounded border leading-none shrink-0', GRADE_COLOR[g])}>{g}</span>
            <span className="text-sm font-semibold text-gray-100 truncate">{callerName(item.qy_wxid || '', i18n.language)}</span>
          </div>
          {/* 胜率进度条 */}
          <div className="flex items-center gap-1.5">
            <div className="w-14 h-1.5 bg-dark-600 rounded-full overflow-hidden shrink-0">
              <div className={clsx('h-full rounded-full', wrBarColor)} style={{ width: `${Math.min(totalWr, 100)}%` }} />
            </div>
            <span className={clsx('text-xs font-bold tabular-nums shrink-0', wrColor)}>{totalWr.toFixed(0)}%</span>
            <span className="text-[11px] text-gray-500 shrink-0">{t('leaderboard.row.today_short', { pct: todayWr.toFixed(0) })}</span>
          </div>
        </div>

        {/* 右侧：收益率 + 喊单数 + 按钮（垂直堆叠） */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {/* 今日收益率 */}
          <span className={clsx('text-base font-bold tabular-nums font-mono leading-none', pctColor)}>
            {avgTodayPct !== null ? `${avgTodayPct >= 0 ? '+' : ''}${avgTodayPct.toFixed(1)}%` : '—'}
          </span>
          {/* 喊单数 */}
          <span className="text-[11px] text-gray-500 leading-none">
            {item.ca_count}单 涨{item.rise_count}/赢{item.win_count}
          </span>
          {/* 跟单按钮 */}
          <div onClick={e => e.stopPropagation()}>
            {isFollowing ? (
              <button onClick={() => onFollowClick(item)}
                className={clsx('cp-btn text-[11px] px-2 py-0.5 border font-medium',
                  isFollowing.enabled
                    ? 'border-green-600/50 text-green-400 bg-green-900/20'
                    : 'border-gray-600/40 text-gray-500'
                )}>
                {isFollowing.enabled ? t('leaderboard.follow.following_short') : t('leaderboard.follow.paused_short')}
              </button>
            ) : (
              <button onClick={() => onFollowClick(item)}
                className="cp-btn text-[11px] px-2 py-0.5 border border-accent-green/40 text-accent-green bg-accent-green/10 font-medium">
                {t('leaderboard.follow.add_short')}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && <div className="mt-2 -mx-3"><ExpandedPanel item={item} /></div>}
    </div>
  )

  // ── 桌面端表格行 ──────────────────────────────────────────────
  return (
    <>
      {/* 移动端卡片 */}
      <tr className="md:hidden">
        <td colSpan={14} className="p-0">
          <MobileCard />
        </td>
      </tr>

      {/* 桌面端表格行 */}
      <tr className={clsx('hidden md:table-row border-b border-dark-600/50 transition-all cursor-pointer web3-row',
        isSelected && 'bg-accent-green/5',
        expanded && 'web3-row-active'
      )} onClick={() => onDetailClick(item)}>
        <td className="pl-4 pr-2 py-4 w-12 text-center">{rankNode}</td>
        <td className="px-3 py-4 min-w-[150px]">
          <div className="flex items-center gap-2.5">
            <Identicon seed={item.qy_wxid} size={36} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded border', GRADE_COLOR[g])}>{g}</span>
                <span className="text-sm text-gray-200 font-medium truncate max-w-[110px]" title={callerName(item.qy_wxid || '', i18n.language)}>
                  {callerName(item.qy_wxid || '', i18n.language)}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{t('leaderboard.row.history_count', { n: item.total_ca_count })}</div>
            </div>
          </div>
        </td>
        <td className="px-3 py-4 w-28 text-center">
          {avgTodayPct === null ? <span className="text-gray-600 text-sm">—</span> : (() => {
            const color = avgTodayPct >= 50 ? 'text-yellow-300' : avgTodayPct >= 20 ? 'text-green-400' : avgTodayPct >= 0 ? 'text-green-600' : 'text-red-400'
            return (
              <div>
                <div className={clsx('text-base font-bold tabular-nums font-mono', color)}>{avgTodayPct >= 0 ? '+' : ''}{avgTodayPct.toFixed(1)}%</div>
                <div className="text-xs text-gray-500 mt-0.5">{t('leaderboard.row.avg_count', { n: item.ca_count })}</div>
              </div>
            )
          })()}
        </td>
        <td className="px-3 py-4 w-28 text-center hidden lg:table-cell">
          {sevenMult > 0 ? (() => {
            const color = sevenMult >= 50 ? 'text-yellow-300' : sevenMult >= 20 ? 'text-green-400' : 'text-green-600'
            return (
              <div>
                <div className={clsx('text-base font-bold tabular-nums font-mono', color)}>+{sevenMult.toFixed(1)}x</div>
                <div className="text-xs text-gray-500 mt-0.5">{t('leaderboard.row.seven_day_cum')}</div>
              </div>
            )
          })() : <SevenDayReturn history={history} />}
        </td>
        <td className="px-3 py-4 w-24 text-center hidden sm:table-cell">
          <div className="text-base font-bold tabular-nums text-gray-300">{item.total_ca_count}</div>
          <div className="text-xs text-gray-500 mt-0.5">{t('leaderboard.row.won')} <span className="font-medium">{item.total_win_count}</span></div>
        </td>
        <td className="px-3 py-4 w-32"><WinRateBar rate={totalWr} today={todayWr} /></td>
        <td className="px-3 py-4 w-24 text-center">
          {(() => {
            const color = todayMult >= 10 ? 'text-yellow-300' : todayMult >= 5 ? 'text-green-400' : todayMult >= 2 ? 'text-blue-400' : 'text-gray-500'
            return (
              <div>
                <span className={clsx('text-base font-bold tabular-nums font-mono', color)}>{todayMult >= 0.01 ? `${todayMult.toFixed(2)}x` : '—'}</span>
                <div className="text-xs text-gray-500 mt-0.5">{t('leaderboard.row.today_cum')}</div>
              </div>
            )
          })()}
        </td>
        <td className="px-3 py-4 hidden md:table-cell"><RecentTokens records={item.records} /></td>
        <td className="px-3 py-4 w-28 text-center hidden sm:table-cell">
          {(() => {
            const times = (item.records || []).map(r => r.call_time).filter(Boolean)
            if (!times.length) return <span className="text-gray-600 text-sm">—</span>
            const latest = new Date(Math.max(...times.map(t => new Date(t).getTime())))
            const diff = Date.now() - latest.getTime()
            const mins = Math.floor(diff / 60000)
            const hours = Math.floor(mins / 60)
            const ago = mins < 1
              ? t('leaderboard.row.ago_just_now')
              : mins < 60
              ? t('leaderboard.row.ago_minutes', { n: mins })
              : hours < 24
              ? t('leaderboard.row.ago_hours', { n: hours })
              : t('leaderboard.row.ago_days', { n: Math.floor(hours / 24) })
            const timeStr = latest.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' })
            return <div><div className="text-sm font-medium text-gray-300 tabular-nums">{timeStr}</div><div className="text-xs text-gray-500 mt-0.5">{ago}</div></div>
          })()}
        </td>
        <td className="px-2 py-4 w-20 text-center" onClick={e => e.stopPropagation()}>
          {isFollowing ? (
            <button onClick={() => onFollowClick(item)} className={clsx('cp-btn text-xs px-2.5 py-1.5 border transition-colors whitespace-nowrap font-medium', isFollowing.enabled ? 'border-green-600/50 text-green-400 bg-green-900/20 hover:bg-green-900/40' : 'border-gray-600/50 text-gray-500 bg-dark-700/20 hover:bg-dark-700/40')}>
              {isFollowing.enabled ? t('leaderboard.follow.following') : t('leaderboard.follow.paused')}
            </button>
          ) : (
            <button onClick={() => onFollowClick(item)} className="cp-btn text-xs px-2.5 py-1.5 border border-accent-green/40 text-accent-green bg-accent-green/10 hover:border-accent-green/70 transition-all whitespace-nowrap font-mono">
              {t('leaderboard.follow.add')}
            </button>
          )}
        </td>
        <td className="pr-3 py-4 w-6 text-center" onClick={e => { e.stopPropagation(); onToggle() }}>
          <span className={clsx('text-gray-500 text-xs transition-transform inline-block', expanded && 'rotate-180')}>▼</span>
        </td>
      </tr>

      {expanded && (
        <tr className="hidden md:table-row border-b border-dark-700/40">
          <td colSpan={13}><ExpandedPanel item={item} /></td>
        </tr>
      )}
    </>
  )
}

export default function SocialLeaderboard() {
  const { t } = useTranslation()
  const [data, setData]           = useState([])
  const [history, setHistory]     = useState({})
  const [followMap, setFollowMap] = useState({})  // wxid → follow config
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [threshold, setThreshold] = useState(0.2)
  const [expanded, setExpanded]   = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [detailCaller, setDetailCaller] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [followTarget, setFollowTarget] = useState(null)
  const [sortKey, setSortKey] = useState('rank')
  const [sortDir, setSortDir] = useState('asc')
  const [batchFollowEnabled, setBatchFollowEnabled] = useState(false)
  const [batchFollowing, setBatchFollowing] = useState(false)
  const [batchResult, setBatchResult] = useState(null)  // {added, skipped} | null
  const [batchConfigOpen, setBatchConfigOpen] = useState(false)
  const [batchDefaults, setBatchDefaults] = useState({
    buy_amount: '0.1',
    take_profit: '50',
    stop_loss: '30',
    max_hold_min: '60',
  })

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'last_call' ? 'desc' : 'desc') // 时间默认最新在前，其余默认降序
    }
  }

  const sortedData = [...data].sort((a, b) => {
    let av, bv
    switch (sortKey) {
      case 'rank':         av = a.rank; bv = b.rank; break
      case 'today_pct':    av = a.ca_count > 0 ? a.total_multiplier / a.ca_count : 0; bv = b.ca_count > 0 ? b.total_multiplier / b.ca_count : 0; break
      case 'seven_mult':   av = a.total_multiplier_7d || 0; bv = b.total_multiplier_7d || 0; break
      case 'ca_count':     av = a.ca_count; bv = b.ca_count; break
      case 'total_ca':     av = a.total_ca_count; bv = b.total_ca_count; break
      case 'win_rate':     av = parseFloat(a.win_rate) || 0; bv = parseFloat(b.win_rate) || 0; break
      case 'today_wr':     av = parseFloat(a.today_win_rate) || 0; bv = parseFloat(b.today_win_rate) || 0; break
      case 'total_mult':   av = a.total_multiplier || 0; bv = b.total_multiplier || 0; break
      case 'last_call': {
        const getLatest = (item) => {
          const times = (item.records || []).map(r => r.call_time).filter(Boolean)
          return times.length ? Math.max(...times.map(t => new Date(t).getTime())) : 0
        }
        av = getLatest(a); bv = getLatest(b); break
      }
      default: av = a.rank; bv = b.rank
    }
    return sortDir === 'asc' ? av - bv : bv - av
  })

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}?rise_threshold=${threshold}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const json = await r.json()
      if (json.status !== 'success') throw new Error('API error')
      setData(json.data || [])
      setLastUpdate(Date.now())
      setError(null)
      // 同步拉历史 + 跟单列表
      const [hr, fr] = await Promise.all([
        fetch(HISTORY_URL),
        fetch('/api/analytics/follow_traders'),
      ])
      if (hr.ok) setHistory(await hr.json())
      if (fr.ok) {
        const follows = await fr.json()
        const map = {}
        follows.forEach(f => { map[f.wxid] = f })
        setFollowMap(map)
      }
      // 读取配置（一键跟单开关）
      try {
        const cfgR = await fetch('/api/config')
        if (cfgR.ok) {
          const cfg = await cfgR.json()
          setBatchFollowEnabled(cfg.leaderboard_batch_follow_enabled === 'true')
        }
      } catch (_) {}
    } catch (e) {
      setError('数据加载失败：' + e.message)
    } finally {
      setLoading(false)
    }
  }, [threshold])

  useEffect(() => { setLoading(true); fetchData() }, [fetchData])
  useEffect(() => {
    const t = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [fetchData])

  const handleBatchFollow = async (defaults) => {
    if (!data.length || batchFollowing) return
    setBatchConfigOpen(false)
    setBatchFollowing(true)
    setBatchResult(null)
    try {
      const traders = data
        .filter(item => item.qy_wxid)
        .map(item => ({ wxid: item.qy_wxid, name: item.name || '' }))
      const r = await fetch('/api/analytics/follow_traders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traders, defaults }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const result = await r.json()
      setBatchResult({ added: result.added, updated: result.updated })
      // 刷新跟单列表
      const fr = await fetch('/api/analytics/follow_traders')
      if (fr.ok) {
        const follows = await fr.json()
        const map = {}
        follows.forEach(f => { map[f.wxid] = f })
        setFollowMap(map)
      }
    } catch (e) {
      setBatchResult({ error: e.message })
    } finally {
      setBatchFollowing(false)
    }
  }

  const THRESHOLD_OPTS = [
    { key: 0.1,  label: '≥10%' },
    { key: 0.2,  label: '≥20%' },
    { key: 0.5,  label: '≥50%' },
    { key: 1.0,  label: '≥100%' },
    { key: 2.0,  label: '≥200%' },
  ]

  const [nameSearch, setNameSearch] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    window.__leaderboardSearch = setNameSearch
    return () => { delete window.__leaderboardSearch }
  }, [])

  useEffect(() => {
    window.__memeData = data
    window.dispatchEvent(new CustomEvent('meme-data'))
  }, [data])

  const CATEGORIES = [
    { key: 'all',     label: t('leaderboard.filter.all')     },
    { key: 'winrate', label: t('leaderboard.filter.winrate') },
    { key: 'mult',    label: t('leaderboard.filter.mult')    },
    { key: 'active',  label: t('leaderboard.filter.active')  },
  ]

  const filteredData = useMemo(() => {
    let d = sortedData
    if (nameSearch) d = d.filter(item => (item.name || '').toLowerCase().includes(nameSearch.toLowerCase()))
    if (category === 'winrate') d = d.filter(item => parseFloat(item.win_rate) >= 60)
    if (category === 'mult')    d = d.filter(item => (item.total_multiplier || 0) >= 20)
    if (category === 'active')  d = d.filter(item => (item.total_ca_count || 0) >= 200)
    return d
  }, [sortedData, nameSearch, category])

  return (
    <div className="flex h-full min-h-0">
      {/* 详情页覆盖 */}
      {detailCaller && (
        <CallerDetailPage
          item={detailCaller}
          history={history[detailCaller.qy_wxid] || []}
          onBack={() => setDetailCaller(null)}
          onFollowClick={() => { setFollowTarget(detailCaller) }}
        />
      )}

      {/* 跟单弹窗 */}
      {followTarget && (
        <FollowModal
          item={followTarget}
          onClose={() => setFollowTarget(null)}
          onSaved={() => { setFollowTarget(null); fetchData() }}
        />
      )}

      {/* 一键跟单配置弹窗 */}
      {batchConfigOpen && (
        <div className="cp-modal-backdrop fixed inset-0 z-50 flex items-center justify-center" onClick={() => setBatchConfigOpen(false)}>
          <div className="web3-frame w-[480px] max-w-[94vw]" onClick={e => e.stopPropagation()}>
            <span className="w3-corners" aria-hidden="true"><i></i></span>
            <div className="web3-frame-inner cp-modal-bg">
              {/* 头部 */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3 gap-3">
                <div className="min-w-0">
                  <h3 className="cp-modal-title">{t('leaderboard.batch_modal.title')}</h3>
                  <p className="cp-modal-subtitle truncate !normal-case">
                    {t('leaderboard.batch_modal.subtitle', { n: data.filter(d => d.qy_wxid).length })}
                  </p>
                </div>
                <button onClick={() => setBatchConfigOpen(false)} className="cp-modal-close shrink-0" aria-label={t('common.close')}>×</button>
              </div>
              <div className="cp-modal-divider" />

              <div className="px-6 py-5 space-y-5">
                {/* 跟单金额 */}
                <div>
                  <label className="cp-modal-label">{t('follow_modal.buy_amount')}</label>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {[0.05, 0.1, 0.2, 0.5, 1].map(v => (
                      <button key={v} onClick={() => setBatchDefaults(p => ({ ...p, buy_amount: v }))}
                        className={clsx('cp-chip', parseFloat(batchDefaults.buy_amount) === v && 'cp-chip-active')}>{v}U</button>
                    ))}
                  </div>
                  <input type="number" step="0.01" min="0.01" value={batchDefaults.buy_amount}
                    onChange={e => setBatchDefaults(p => ({ ...p, buy_amount: e.target.value }))}
                    className="cp-input" />
                </div>

                {/* 止盈止损 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="cp-modal-label">{t('follow_modal.take_profit')}</label>
                    <input type="number" step="5" min="1" value={batchDefaults.take_profit}
                      onChange={e => setBatchDefaults(p => ({ ...p, take_profit: e.target.value }))}
                      className="cp-input" />
                  </div>
                  <div>
                    <label className="cp-modal-label">{t('follow_modal.stop_loss')}</label>
                    <input type="number" step="5" min="1" value={batchDefaults.stop_loss}
                      onChange={e => setBatchDefaults(p => ({ ...p, stop_loss: e.target.value }))}
                      className="cp-input" />
                  </div>
                </div>

                {/* 最长持仓 */}
                <div>
                  <label className="cp-modal-label">{t('follow_modal.max_hold')}</label>
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    {[30, 60, 120, 240].map(v => (
                      <button key={v} onClick={() => setBatchDefaults(p => ({ ...p, max_hold_min: v }))}
                        className={clsx('cp-chip', parseInt(batchDefaults.max_hold_min) === v && 'cp-chip-active')}>
                        {t('follow_modal.minutes_unit', { n: v })}
                      </button>
                    ))}
                  </div>
                  <input type="number" step="10" min="1" value={batchDefaults.max_hold_min}
                    onChange={e => setBatchDefaults(p => ({ ...p, max_hold_min: e.target.value }))}
                    className="cp-input" />
                </div>

                <div className="cp-modal-divider mt-1" />

                {/* 按钮 */}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setBatchConfigOpen(false)}
                    className="cp-btn flex-1 py-2.5 text-sm font-mono font-bold tracking-wider uppercase border border-dark-500 text-gray-400 hover:text-gray-200">
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => handleBatchFollow({
                      buy_amount: parseFloat(batchDefaults.buy_amount) || 0.1,
                      take_profit: parseFloat(batchDefaults.take_profit) || 50,
                      stop_loss: parseFloat(batchDefaults.stop_loss) || 30,
                      max_hold_min: parseInt(batchDefaults.max_hold_min) || 60,
                    })}
                    disabled={batchFollowing}
                    className="cp-btn flex-1 py-2.5 text-sm font-mono font-bold tracking-wider uppercase border border-accent-green/70 text-accent-green bg-accent-green/15 hover:bg-accent-green/25 disabled:opacity-40 disabled:cursor-not-allowed">
                    {batchFollowing ? t('leaderboard.batch_modal.saving') : t('leaderboard.batch_modal.confirm')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 中间主区 ── */}
      <div className="flex-[6] min-w-0 flex flex-col overflow-hidden">
        {detailCaller ? null : (
          <div className="px-4 pt-3 pb-2 border-b border-dark-600 flex items-center gap-3 shrink-0">
            <div className="flex gap-1">
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setCategory(c.key)}
                  className={clsx('cp-btn px-4 py-1.5 text-sm border transition-all',
                    category === c.key
                      ? 'border-accent-green/60 text-accent-green bg-accent-green/10 font-semibold'
                      : 'border-dark-600 text-gray-500 hover:text-gray-300 hover:border-dark-500'
                  )}>{c.label}</button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              {batchFollowEnabled && (
                <button onClick={() => { setBatchConfigOpen(true); setBatchResult(null) }} disabled={batchFollowing || loading}
                  className={clsx('cp-btn text-xs px-3 py-1.5 border transition-colors',
                    batchFollowing ? 'border-dark-500 text-gray-600 cursor-not-allowed' : 'border-accent-green/50 text-accent-green bg-accent-green/10 hover:bg-accent-green/20'
                  )}>
                  {batchFollowing ? t('leaderboard.batch_following') : t('leaderboard.batch_follow')}
                </button>
              )}
              <button onClick={() => { setLoading(true); fetchData() }}
                className="cp-btn text-xs text-gray-500 hover:text-gray-300 border border-dark-600 hover:border-dark-500 px-2.5 py-1.5 transition-colors">↻</button>
            </div>
          </div>
        )}

        {/* 社区列表 / 详情页 */}
        <div className="flex-1 overflow-y-auto">
          {detailCaller ? null : (
            <div className="px-4 py-3">
              <h2 className="cp-modal-title !text-[22px] !mb-3 truncate">{t('leaderboard.community_list')}</h2>
              <div className="web3-frame">
                <span className="w3-corners" aria-hidden="true"><i></i></span>
                <div className="web3-frame-inner">
                  <span className="web3-scan" aria-hidden="true"></span>
                {loading ? (
                  <div className="py-10"><CyberLoader meta="COMMUNITY LIST" /></div>
                ) : error ? (
                  <div className="py-16 text-center text-red-500 text-sm">{error}</div>
                ) : filteredData.length === 0 ? (
                  <div className="py-16 text-center text-gray-500 text-sm">{t('leaderboard.no_data')}</div>
                ) : (
                  <table className="w-full relative">
                    <thead>
                      <tr style={{background:'#0a0e0d'}} className="border-b border-accent-green/15 web3-thead">
                        {[
                          { key: 'rank',       label: t('leaderboard.col.rank'),          cls: 'pl-4 pr-2 w-12 text-center' },
                          { key: null,         label: t('leaderboard.col.caller'),        cls: 'px-3 text-left' },
                          { key: 'today_pct',  label: t('leaderboard.col.today_pct'),     cls: 'px-3 w-28 text-center' },
                          { key: 'seven_mult', label: t('leaderboard.col.seven_day'),     cls: 'px-3 w-28 text-center hidden lg:table-cell' },
                          { key: 'total_ca',   label: t('leaderboard.col.total_calls'),   cls: 'px-3 w-24 text-center hidden sm:table-cell' },
                          { key: 'win_rate',   label: t('leaderboard.col.win_rate'),      cls: 'px-3 w-32' },
                          { key: 'total_mult', label: t('leaderboard.col.today_mult'),    cls: 'px-3 w-24 text-center' },
                          { key: null,         label: t('leaderboard.col.recent_tokens'), cls: 'px-3 hidden md:table-cell' },
                          { key: 'last_call',  label: t('leaderboard.col.last_call'),     cls: 'px-3 w-28 text-center hidden sm:table-cell' },
                          { key: null,         label: t('leaderboard.col.actions'),       cls: 'px-2 w-20 text-center' },
                          { key: null,         label: '',                                  cls: 'w-6' },
                        ].map(({ key, label, cls }, i) => (
                          <th key={i} className={clsx('py-3 text-xs font-semibold tracking-wide', cls,
                            key ? 'cursor-pointer select-none text-gray-400 hover:text-accent-green transition-colors' : 'text-gray-500'
                          )} onClick={key ? () => handleSort(key) : undefined}>
                            <span className="inline-flex items-center gap-1">
                              {label}
                              {key && <span className="text-[10px] leading-none">{sortKey === key ? (sortDir === 'desc' ? '▼' : '▲') : <span className="text-gray-700">⇅</span>}</span>}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((item) => (
                        <PersonRow
                          key={item.qy_wxid}
                          item={item}
                          history={history[item.qy_wxid] || []}
                          expanded={expanded === item.qy_wxid}
                          onToggle={() => setExpanded(expanded === item.qy_wxid ? null : item.qy_wxid)}
                          onFollowClick={setFollowTarget}
                          onDetailClick={(it) => setSelectedItem(prev => (prev?.qy_wxid === it.qy_wxid ? null : it))}
                          isFollowing={followMap[item.qy_wxid] || null}
                          isSelected={selectedItem?.qy_wxid === item.qy_wxid}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
                </div>
              </div>
              {!loading && !error && filteredData.length > 0 && (
                <p className="cp-hover-text text-xs text-gray-600 text-right mt-2">{t('leaderboard.total_count', { count: filteredData.length })}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 右侧面板（仅桌面，详情页时隐藏） ── */}
      {!detailCaller && (
        <aside className="flex-[4] min-w-0 web3-divider flex flex-col gap-3 p-4 overflow-hidden hidden lg:flex" style={{background:'rgb(10 15 13)'}}>
          <MemeGaugeLarge loading={loading} />
          <WinLossTreemap data={data} loading={loading} selected={selectedItem} onClear={() => setSelectedItem(null)} />
          <MultiplierBarPanel data={data} loading={loading} selected={selectedItem} onClear={() => setSelectedItem(null)} />
        </aside>
      )}
    </div>
  )
}

// ── 搜索栏内嵌 meme 情绪（紧凑横向） ─────────────────────────────
function MemeGaugeInline({ data }) {
  const score = useMemo(() => {
    if (!data.length) return 50
    const avgWr = data.reduce((s, d) => s + (parseFloat(d.win_rate) || 0), 0) / data.length
    return Math.round(Math.min(100, Math.max(0, avgWr)))
  }, [data])
  const label = score >= 70 ? '极度贪婪' : score >= 55 ? '贪婪' : score >= 45 ? '中性' : score >= 30 ? '恐惧' : '极度恐惧'
  const color = score >= 70 ? '#f59e0b' : score >= 55 ? '#22c55e' : score >= 45 ? '#60a5fa' : score >= 30 ? '#f97316' : '#ef4444'
  const R = 28, cx = 36, cy = 34
  const angle = Math.PI - (score / 100) * Math.PI
  const nx = cx + R * Math.cos(angle), ny = cy - R * Math.sin(angle)
  return (
    <div className="flex items-center gap-2 shrink-0 bg-dark-700/60 border border-dark-500 rounded-lg px-2 py-1">
      <svg viewBox="0 0 72 40" width={72} height={40}>
        <path d={`M ${cx-R} ${cy} A ${R} ${R} 0 0 1 ${cx+R} ${cy}`} fill="none" stroke="#1e1e2e" strokeWidth="5" strokeLinecap="round" />
        {[[0,0.2,'#ef4444'],[0.2,0.4,'#f97316'],[0.4,0.6,'#60a5fa'],[0.6,0.8,'#22c55e'],[0.8,1.0,'#f59e0b']].map(([from,to,c],i) => {
          const a1=Math.PI-from*Math.PI, a2=Math.PI-to*Math.PI
          const x1=cx+R*Math.cos(a1), y1=cy-R*Math.sin(a1), x2=cx+R*Math.cos(a2), y2=cy-R*Math.sin(a2)
          return <path key={i} d={`M ${x1} ${y1} A ${R} ${R} 0 0 1 ${x2} ${y2}`} fill="none" stroke={c} strokeWidth="4" strokeLinecap="butt" opacity="0.8" />
        })}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="2.5" fill={color} />
      </svg>
      <div className="flex flex-col leading-none">
        <span className="text-xs font-bold font-mono" style={{color}}>{score}</span>
        <span className="text-[10px] text-gray-500 mt-0.5">{label}</span>
      </div>
    </div>
  )
}

// ── 代币盈亏 Treemap / 社区战绩分布 ──────────────────────────────
function WinLossTreemap({ data, loading = false, selected = null, onClear }) {
  const { t, i18n } = useTranslation()
  const items = useMemo(() => {
    if (selected) {
      // 选中喊单人：聚合其 records 里每个币的出现次数与平均涨幅
      const map = {}
      ;(selected.records || []).forEach(r => {
        const key = r.symbol || r.token?.slice(0, 8) || '?'
        if (!map[key]) map[key] = { name: key, count: 0, multSum: 0 }
        map[key].count++
        map[key].multSum += r.multiplier ?? 0
      })
      return Object.values(map)
        .map(t => ({ ...t, avgMult: t.multSum / t.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 14)
    }
    // 未选中：每个社区（喊单人）一格，大小=今日喊单数，颜色=今日均涨幅
    return data
      .filter(d => (d.ca_count ?? 0) > 0)
      .map(d => ({
        name: callerName(d.qy_wxid || '', i18n.language),
        count: d.ca_count,
        avgMult: (d.total_multiplier ?? 0) / d.ca_count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 14)
  }, [data, selected, i18n.language])

  const title = selected ? t('charts.meme_dist') : t('charts.community_dist')

  if (loading) {
    return (
      <div className="web3-frame cp-hover-card rounded-xl shrink-0">
        <span className="w3-corners" aria-hidden="true"><i></i></span>
        <div className="web3-frame-inner p-3" style={{ background: '#0a0e0d' }}>
          <span className="web3-scan" aria-hidden="true"></span>
          <h2 className="cp-modal-title !text-[22px] !mb-3 truncate relative z-[3]">{title}</h2>
          <div className="relative z-[3]" style={{ paddingBottom: '50%', position: 'relative' }}>
            <CyberLoader className="!absolute !inset-0" meta="MEME MAP" />
          </div>
        </div>
      </div>
    )
  }

  const total = items.reduce((s, t) => s + t.count, 0)
  if (!total) return (
    <div className="web3-frame cp-hover-card rounded-xl shrink-0">
      <span className="w3-corners" aria-hidden="true"><i></i></span>
      <div className="web3-frame-inner p-3" style={{background:'#0a0e0d'}}>
        <span className="web3-scan" aria-hidden="true"></span>
        <h2 className="cp-modal-title !text-[22px] !mb-3 truncate relative z-[3] flex items-center gap-2">
          {title}
          {selected && (
            <span className="inline-flex items-center gap-1 text-xs font-mono text-accent-green/90 border border-accent-green/40 bg-accent-green/10 px-1.5 py-0.5 rounded normal-case tracking-normal">
              {callerName(selected.qy_wxid || '', i18n.language)}
              <button onClick={(e) => { e.stopPropagation(); onClear?.() }} className="text-accent-green/70 hover:text-accent-green">×</button>
            </span>
          )}
        </h2>
        <div className="text-center text-gray-600 text-xs py-8">{t('leaderboard.no_data')}</div>
      </div>
    </div>
  )

  // squarified treemap — cap at 4 rows; final row consumes remaining height
  const W = 100, H = 100
  const MAX_ROWS = 4
  const rects = []
  let remaining = [...items.map(t => ({ ...t, value: t.count }))]
  let y = 0, remH = H
  let rowCount = 0

  while (remaining.length > 0 && rowCount < MAX_ROWS) {
    const remTotal = remaining.reduce((s, t) => s + t.value, 0)
    let rowItems = [remaining[0]], rowSum = remaining[0].value
    for (let i = 1; i < remaining.length; i++) {
      const cand = [...rowItems, remaining[i]]
      const candSum = rowSum + remaining[i].value
      const rowH = (candSum / remTotal) * remH
      const worst = arr => Math.max(...arr.map(t => { const w = (t.value / (arr === cand ? candSum : rowSum)) * W; return Math.max(w / rowH, rowH / w) }))
      if (worst(cand) <= worst(rowItems)) { rowItems = cand; rowSum = candSum }
      else break
    }
    rowCount++
    const isLastRow = rowCount === MAX_ROWS || rowItems.length === remaining.length
    const rowH = isLastRow ? remH : (rowSum / remTotal) * remH
    let x = 0
    rowItems.forEach(t => {
      const w = (t.value / rowSum) * W
      rects.push({ ...t, x, y, w, h: rowH })
      x += w
    })
    y += rowH; remH -= rowH
    remaining = remaining.slice(rowItems.length)
  }

  return (
    <div className="web3-frame cp-hover-card rounded-xl shrink-0">
      <span className="w3-corners" aria-hidden="true"><i></i></span>
      <div className="web3-frame-inner p-3" style={{background:'#0a0e0d'}}>
        <span className="web3-scan" aria-hidden="true"></span>
      <h2 className="cp-modal-title !text-[22px] !mb-3 truncate relative z-[3] flex items-center gap-2">
        {title}
        {selected && (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-accent-green/90 border border-accent-green/40 bg-accent-green/10 px-1.5 py-0.5 rounded normal-case tracking-normal">
            {callerName(selected.qy_wxid || '', i18n.language)}
            <button onClick={(e) => { e.stopPropagation(); onClear?.() }} className="text-accent-green/70 hover:text-accent-green">×</button>
          </span>
        )}
      </h2>
      <div className="cp-meme-canvas relative w-full rounded overflow-hidden z-[3]" style={{ paddingBottom: '65%' }}>
        <div key={selected?.qy_wxid || 'all'} className="absolute inset-0 panel-swap">
          {rects.map((r, i) => {
            const m = r.avgMult
            const up = m >= 0
            // Depth scales with |multiplier|: 0%=barely tinted, 100%+=fully tinted
            const intensity = Math.min(1, 0.15 + Math.abs(m) * 0.85)
            const pct = (m * 100).toFixed(0)
            const showName = r.w > 8 && r.h > 10
            const showPct  = r.w > 10 && r.h > 18
            const fs = Math.max(11, Math.min(16, r.w * 1.4))
            return (
              <div key={i} title={`${r.name} avg ${up?'+':''}${pct}% (${r.count})`}
                className={clsx('cp-meme-tile panel-tile absolute overflow-hidden flex flex-col items-center justify-center', up ? 'cp-meme-up' : 'cp-meme-down')}
                style={{
                  left:`${r.x}%`, top:`${r.y}%`, width:`${r.w}%`, height:`${r.h}%`,
                  '--cp-meme-i': intensity,
                  animationDelay: `${i * 0.025}s`,
                }}>
                {showName && <span className="cp-meme-name font-bold font-mono truncate px-1 leading-tight" style={{ fontSize: fs }}>{r.name}</span>}
                {showPct  && <span className="cp-meme-pct font-bold font-mono leading-tight" style={{ fontSize: Math.max(10, fs * 0.78) }}>{up?'+':''}{pct}%</span>}
              </div>
            )
          })}
          <span className="cp-meme-glitch" aria-hidden="true" />
          <span className="cp-meme-canvas-grid" aria-hidden="true" />
        </div>
      </div>
      </div>
    </div>
  )
}

// ── 涨跌倍数分布（正负色柱状图） ─────────────────────────────────
function MultiplierBarPanel({ data, loading = false, selected = null, onClear }) {
  const { t, i18n } = useTranslation()
  const barData = useMemo(() => {
    // 按涨幅百分比分桶
    const buckets = [
      { label: '<-50%', min: -Infinity, max: -0.5 },
      { label: '-50~-20%', min: -0.5, max: -0.2 },
      { label: '-20~0%', min: -0.2, max: 0 },
      { label: '0~20%', min: 0, max: 0.2 },
      { label: '20~50%', min: 0.2, max: 0.5 },
      { label: '50~100%', min: 0.5, max: 1 },
      { label: '1-2x', min: 1, max: 2 },
      { label: '2-5x', min: 2, max: 5 },
      { label: '5-10x', min: 5, max: 10 },
      { label: '>10x', min: 10, max: Infinity },
    ]
    const counts = buckets.map(b => ({ label: b.label, count: 0, pos: b.min >= 0 }))

    if (selected) {
      // 单人：按该喊单人每个币的 multiplier 分桶
      ;(selected.records || []).forEach(r => {
        const m = r.multiplier ?? 0
        const idx = buckets.findIndex(b => m >= b.min && m < b.max)
        if (idx >= 0) counts[idx].count++
      })
    } else {
      // 全榜：按每位喊单人均涨幅分桶
      data.forEach(d => {
        const total = d.ca_count ?? 0
        if (!total) return
        const avg = (d.total_multiplier ?? 0) / total
        const idx = buckets.findIndex(b => avg >= b.min && avg < b.max)
        if (idx >= 0) counts[idx].count++
      })
    }
    return counts
  }, [data, selected])

  const maxCount = Math.max(1, ...barData.map(d => d.count))

  if (loading) {
    return (
      <div className="web3-frame cp-hover-card rounded-xl flex-1 flex flex-col min-h-0">
        <span className="w3-corners" aria-hidden="true"><i></i></span>
        <div className="web3-frame-inner p-3 flex-1 flex flex-col min-h-0" style={{ background: '#0a0e0d' }}>
          <span className="web3-scan" aria-hidden="true"></span>
          <h2 className="cp-modal-title !text-[22px] !mb-3 truncate relative z-[3]">{t('charts.gain_loss_dist')}</h2>
          <div className="flex-1 min-h-0 relative z-[3] flex items-center justify-center">
            <CyberLoader meta="DISTRIBUTION" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="web3-frame cp-hover-card rounded-xl flex-1 flex flex-col min-h-0">
      <span className="w3-corners" aria-hidden="true"><i></i></span>
      <div className="web3-frame-inner p-3 flex-1 flex flex-col min-h-0" style={{background:'#0a0e0d'}}>
        <span className="web3-scan" aria-hidden="true"></span>
      <h2 className="cp-modal-title !text-[22px] !mb-3 truncate relative z-[3] flex items-center gap-2">
        {t('charts.gain_loss_dist')}
        {selected && (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-accent-green/90 border border-accent-green/40 bg-accent-green/10 px-1.5 py-0.5 rounded normal-case tracking-normal">
            {callerName(selected.qy_wxid || '', i18n.language)}
            <button onClick={(e) => { e.stopPropagation(); onClear?.() }} className="text-accent-green/70 hover:text-accent-green">×</button>
          </span>
        )}
      </h2>
      <div key={selected?.qy_wxid || 'all'} className="cp-bar-chart flex-1 min-h-0 relative z-[3] panel-swap">
        {barData.map((d, i) => {
          const pct = (d.count / maxCount) * 100
          const empty = d.count === 0
          return (
            <div key={i} className="cp-bar-col">
              <div className="cp-bar-count">{d.count > 0 ? d.count : ''}</div>
              <div className="cp-bar-track">
                <div
                  className={clsx('cp-bar panel-bar', d.pos ? 'cp-bar-up' : 'cp-bar-down', empty && 'cp-bar-empty')}
                  style={{ height: `${pct}%`, animationDelay: `${i * 0.04}s` }}
                >
                  <span className="cp-bar-stream" />
                  <span className="cp-bar-cap" />
                  <span className="cp-bar-sparks" />
                </div>
              </div>
              <div className="cp-bar-label">{d.label}</div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

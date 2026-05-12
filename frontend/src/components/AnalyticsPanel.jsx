import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceDot,
} from 'recharts'
import { Card } from './UI'
import { clsx } from 'clsx'

const API = ''

function shortHash(s) {
  if (!s) return '????'
  let h = 0
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0
  return (h >>> 0).toString(16).slice(0, 4).toUpperCase().padStart(4, '0')
}

const CHAIN_EXPLORER_TX = {
  BSC:    tx => `https://bscscan.com/tx/${tx}`,
  ETH:    tx => `https://etherscan.io/tx/${tx}`,
  SOL:    tx => `https://solscan.io/tx/${tx}`,
  BASE:   tx => `https://basescan.org/tx/${tx}`,
  XLAYER: tx => `https://www.oklink.com/xlayer/tx/${tx}`,
}

const CHAIN_COLORS = {
  SOL: '#9945FF', BSC: '#F0B90B', ETH: '#627EEA', XLAYER: '#00D4AA', UNKNOWN: '#6B7280',
}

const CHART_TOOLTIP = {
  background: 'rgba(8,13,11,0.96)',
  border: '1px solid rgba(0,255,135,0.4)',
  borderRadius: 0,
  fontSize: 12,
  fontFamily: 'ui-monospace, monospace',
}
const CHART_GRID = 'rgba(0,255,135,0.08)'
const CHART_TICK = { fill: '#a8c0b3', fontSize: 12, fontWeight: 600, fontFamily: 'ui-monospace, monospace' }

const fetchJson = p => fetch(API + p).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })

function fmtCap(v) {
  if (!v) return '—'
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K'
  return '$' + v.toFixed(0)
}
function fmtPct(v) {
  if (v == null) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(1) + '%'
}
function rateColor(v) {
  if (v == null) return 'text-gray-500'
  if (v >= 60) return 'text-accent-green'
  if (v >= 40) return 'text-accent-yellow'
  return 'text-accent-red'
}

// 后端 filter_reason 字符串 → i18n key 映射
// 静态短语直接命中；动态短语用正则提取数值后用 i18next 模板翻译
const REASON_STATIC = {
  '通过所有过滤条件': 'analytics.filter_reasons.all_passed',
  '代币可增发，跳过': 'analytics.filter_reasons.mintable_skip',
}
const REASON_PATTERNS = [
  { re: /^蜜罐检测.*is_honeypot=1/,                                              key: 'analytics.filter_reasons.honeypot_confirmed' },
  { re: /^蜜罐检测/,                                                              key: 'analytics.filter_reasons.honeypot_unknown_skip' },
  { re: /^市值\s+\$([\d.]+)\s+<\s+下限\s+\$([\d.]+)$/,                          key: 'analytics.filter_reasons.mc_too_low',          map: m => ({ v: m[1], min: m[2] }) },
  { re: /^市值\s+\$([\d.]+)\s+>\s+上限\s+\$([\d.]+)$/,                          key: 'analytics.filter_reasons.mc_too_high',         map: m => ({ v: m[1], max: m[2] }) },
  { re: /^全网发送次数\s+(\d+)\s+<\s+(\d+)$/,                                     key: 'analytics.filter_reasons.qwfc_low',            map: m => ({ v: m[1], min: m[2] }) },
  { re: /^本群发送次数\s+(\d+)\s+<\s+(\d+)$/,                                     key: 'analytics.filter_reasons.bqfc_low',            map: m => ({ v: m[1], min: m[2] }) },
  { re: /^覆盖群数量\s+(\d+)\s+<\s+(\d+)$/,                                       key: 'analytics.filter_reasons.fgq_low',             map: m => ({ v: m[1], min: m[2] }) },
  { re: /^个人查询次数\s+(\d+)\s+<\s+(\d+)$/,                                     key: 'analytics.filter_reasons.grcxcs_low',          map: m => ({ v: m[1], min: m[2] }) },
  { re: /^5分钟涨幅\s+([-\d.]+)%\s+<\s+([-\d.]+)%$/,                            key: 'analytics.filter_reasons.price_5m_low',        map: m => ({ v: m[1], min: m[2] }) },
  { re: /^1小时买入量\s+\$([\d.]+)\s+<\s+\$([\d.]+)$/,                          key: 'analytics.filter_reasons.buy_vol_low',         map: m => ({ v: m[1], min: m[2] }) },
  { re: /^持有人数\s+(\d+)\s+<\s+(\d+)$/,                                         key: 'analytics.filter_reasons.holders_low',         map: m => ({ v: m[1], min: m[2] }) },
  { re: /^风险评分\s+([\d.]+)\s+>\s+([\d.]+)$/,                                   key: 'analytics.filter_reasons.risk_high',           map: m => ({ v: m[1], max: m[2] }) },
  { re: /^最大持仓比\s+([\d.]+)%\s+>\s+([\d.]+)%.*$/,                             key: 'analytics.filter_reasons.max_holder_high',     map: m => ({ v: m[1], max: m[2] }) },
  { re: /^已涨\s+([\d.]+)x\s+超过上限\s+([\d.]+)x.*$/,                            key: 'analytics.filter_reasons.current_mult_high',   map: m => ({ v: m[1], max: m[2] }) },
  { re: /^全局胜率\s+([\d.]+)%\s+<\s+([\d.]+)%$/,                                 key: 'analytics.filter_reasons.sender_winrate_low',  map: m => ({ v: m[1], min: m[2] }) },
  { re: /^群胜率\s+([\d.]+)%\s+<\s+([\d.]+)%$/,                                   key: 'analytics.filter_reasons.sender_group_winrate_low', map: m => ({ v: m[1], min: m[2] }) },
  { re: /^历史发币数\s+(\d+)\s+<\s+(\d+)$/,                                       key: 'analytics.filter_reasons.sender_total_low',    map: m => ({ v: m[1], min: m[2] }) },
  { re: /^历史最高倍数\s+([\d.]+)x\s+<\s+([\d.]+)x$/,                             key: 'analytics.filter_reasons.sender_best_mult_low', map: m => ({ v: m[1], min: m[2] }) },
]
function translateReason(t, reason) {
  if (!reason) return ''
  const staticKey = REASON_STATIC[reason]
  if (staticKey) return t(staticKey)
  for (const p of REASON_PATTERNS) {
    const m = reason.match(p.re)
    if (m) return t(p.key, p.map ? p.map(m) : undefined)
  }
  return reason
}

// ── 通用组件 ────────────────────────────────────────────────────────
function Subhead({ children }) {
  return <div className="cp-cfg-subhead !mb-4">{children}</div>
}

function StatPanel({ label, value, tone = 'green' }) {
  const c = { green: 'text-accent-green', red: 'text-accent-red', blue: 'text-accent-blue', yellow: 'text-accent-yellow', gray: 'text-gray-300' }[tone]
  return (
    <div className="cp-stat-panel !p-3 min-w-[100px] text-center">
      <div className={clsx('text-xl font-bold font-mono leading-tight', c)} style={{ textShadow: '0 0 8px currentColor' }}>{value}</div>
      <div className="cp-stat-key !text-[12px] !font-bold mt-1">{label}</div>
    </div>
  )
}

function EmptyState({ text }) {
  const { t } = useTranslation()
  return <div className="py-10 text-center text-gray-500 font-mono text-sm tracking-wider">{text || t('analytics.no_data')}</div>
}

function LoadingState() {
  const { t } = useTranslation()
  return <div className="py-10 text-center text-accent-green/50 font-mono text-sm tracking-wider animate-pulse">{t('analytics.loading')}</div>
}

// ── P&L 曲线 (主 KPI) ────────────────────────────────────────────────

function groupByBucket(series, gran) {
  if (gran === 'trade') {
    let cum = 0
    return series.map(p => {
      const v = Math.abs(p.pnl_usdt)
      cum += v
      return {
        time: new Date(p.time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }),
        cumPnl: Math.round(cum * 1e4) / 1e4,
        pnl: v,
      }
    })
  }
  const fmt = gran === 'hour'
    ? t => new Date(t).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).replace(/\//g, '-')
    : t => new Date(t).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
  const buckets = new Map()
  for (const p of series) {
    const k = fmt(p.time)
    const c = buckets.get(k) || { time: k, pnl: 0 }
    c.pnl = Math.round((c.pnl + Math.abs(p.pnl_usdt)) * 1e4) / 1e4
    buckets.set(k, c)
  }
  let cum = 0
  return Array.from(buckets.values()).map(b => { cum = Math.round((cum + b.pnl) * 1e4) / 1e4; return { ...b, cumPnl: cum } })
}

function PnlCurveCard({ days, positions = [], portfolio = null, posCount = 0 }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [gran, setGran] = useState('trade')

  useEffect(() => { setData(null); fetchJson(`/api/analytics/pnl_series?days=${days}`).then(setData).catch(() => {}) }, [days])

  const s = data?.summary
  const chartData = data?.series ? groupByBucket(data.series, gran) : []
  const isUp = (s?.total_pnl_usdt || 0) >= 0
  const pnlColor = isUp ? '#00ff87' : '#ff2d55'

  const floatPnl    = positions.reduce((acc, p) => acc + (p.pnl_usdt || 0), 0)
  const floatInvest = positions.reduce((acc, p) => acc + (p.amount_usdt || 0), 0)
  const isFloatPos  = floatPnl >= 0
  const posValue = portfolio?.total_position_value_usdt ?? 0
  const totalCash = portfolio
    ? portfolio.chains.reduce((acc, c) => acc + (Number(c.usdt_balance) || 0), 0)
    : 0
  const totalAsset = totalCash + posValue

  const grans = [
    { label: t('analytics.pnl.gran_trade'), value: 'trade' },
    { label: t('analytics.pnl.gran_hour'),  value: 'hour' },
    { label: t('analytics.pnl.gran_day'),   value: 'day' },
  ]

  const tiles = [
    {
      label: t('analytics.kpi.positions'),
      value: String(posCount),
      tone: posCount > 0 ? 'text-accent-yellow' : 'text-gray-600',
      hint: t('analytics.kpi.invest_hint', { u: floatInvest.toFixed(1) }),
    },
    {
      label: t('analytics.kpi.float_pnl'),
      value: posCount === 0 ? '—' : (isFloatPos ? '+' : '') + floatPnl.toFixed(3) + 'U',
      tone: posCount === 0 ? 'text-gray-600' : isFloatPos ? 'text-accent-green' : 'text-accent-red',
    },
    {
      label: t('analytics.kpi.pos_value'),
      value: `$${posValue.toFixed(2)}`,
      tone: 'text-accent-yellow',
    },
    {
      label: t('analytics.kpi.cash_usdt'),
      value: `${totalCash.toFixed(2)}U`,
      tone: 'text-accent-green',
    },
    {
      label: t('analytics.kpi.total_assets'),
      value: `$${totalAsset.toFixed(2)}`,
      tone: 'text-accent-yellow',
    },
  ]

  return (
    <Card className="cp-cfg-card">
      {/* 实时钱包总览 — 使用与设置/首页一致的 cp-stat-panel 风格 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {tiles.map(tile => (
          <div key={tile.label} className="cp-stat-panel !p-3 text-center">
            <div
              className={clsx('cp-stat-val !text-xl !leading-tight tabular-nums', tile.tone)}
              style={{ textShadow: '0 0 8px currentColor' }}
            >
              {tile.value}
            </div>
            <div className="cp-stat-key !text-[12px] !font-bold mt-1">{tile.label}</div>
            {tile.hint && (
              <div className="text-[12px] font-mono font-semibold text-gray-400 tracking-wider mt-0.5">{tile.hint}</div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <Subhead>{t('analytics.pnl.title', { n: days })}</Subhead>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {grans.map(g => (
              <button key={g.value} onClick={() => setGran(g.value)}
                className={clsx('cp-chip !text-[13px] !font-bold !py-1', gran === g.value && 'cp-chip-active')}>
                {g.label}
              </button>
            ))}
          </div>
          {s && (
            <div className="flex gap-2">
              <StatPanel label={t('analytics.pnl.total_pnl')} value={'+' + Math.abs(s.total_pnl_usdt) + 'U'} tone="green" />
              <StatPanel label={t('analytics.pnl.win_rate')} value={s.win_rate + '%'} tone="blue" />
              <StatPanel label={t('analytics.pnl.trade_count')} value={s.total_trades} tone="gray" />
            </div>
          )}
        </div>
      </div>

      {!data ? <LoadingState /> : chartData.length === 0 ? <EmptyState text={t('analytics.no_trades_data')} /> : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="pnlLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00c6ff" />
                <stop offset="50%" stopColor="#00ff87" />
                <stop offset="100%" stopColor="#f9d423" />
              </linearGradient>
              <linearGradient id="pnlAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00ff87" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#00ff87" stopOpacity={0.02} />
              </linearGradient>
              <filter id="pnlGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
            <XAxis dataKey="time" tick={CHART_TICK} interval="preserveStartEnd" stroke="rgba(0,255,135,0.15)" />
            <YAxis tick={CHART_TICK} tickFormatter={v => v.toFixed(2)} stroke="rgba(0,255,135,0.15)" width={52} />
            <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: '#7effc2' }}
              formatter={(v, n) => [typeof v === 'number' ? v.toFixed(4) + 'U' : v, n]} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 2" />
            <Area type="monotone" dataKey="cumPnl"
              stroke="url(#pnlLineGrad)" strokeWidth={2.5}
              fill="url(#pnlAreaGrad)"
              dot={gran !== 'trade' ? { fill: '#00ff87', r: 3, strokeWidth: 0 } : false}
              activeDot={{ r: 5, fill: '#f9d423', strokeWidth: 0 }}
              filter="url(#pnlGlow)"
              name={t('analytics.pnl.cum')} />
            {gran !== 'trade' && (
              <Area type="monotone" dataKey="pnl" stroke="#7a9286" fill="none"
                dot={false} strokeWidth={1} strokeDasharray="4 2" name={t('analytics.pnl.current')} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}

// ── 信号漏斗 ─────────────────────────────────────────────────────────
function FunnelCard({ days, syncHeight }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  useEffect(() => { fetchJson(`/api/analytics/funnel?days=${days}`).then(setData).catch(() => {}) }, [days])

  const cardStyle = syncHeight ? { height: syncHeight } : undefined
  const cardClass = clsx('cp-cfg-card flex flex-col', syncHeight && 'overflow-hidden')

  if (!data) return <Card className={cardClass} style={cardStyle}><Subhead>{t('analytics.funnel.title_short')}</Subhead><LoadingState /></Card>
  if (!Array.isArray(data.filter_breakdown)) return <Card className={cardClass} style={cardStyle}><Subhead>{t('analytics.funnel.title_short')}</Subhead><EmptyState text={t('analytics.funnel.backend_not_ready')} /></Card>

  const total = data.total_received || 1
  const steps = [
    { key: 'received',   label: t('analytics.funnel.received'),   value: data.total_received, color: '#00d4ff' },
    { key: 'passed',     label: t('analytics.funnel.passed'),     value: data.filter_passed,  color: '#a855f7' },
    { key: 'bought',     label: t('analytics.funnel.bought'),     value: data.bought || 0,    color: '#00ff87' },
    { key: 'profitable', label: t('analytics.funnel.profitable'), value: data.profitable || 0, color: '#00ff87' },
    { key: 'loss',       label: t('analytics.funnel.loss'),       value: data.loss || 0,       color: '#ff2d55' },
  ]

  return (
    <Card className={cardClass} style={cardStyle}>
      <Subhead>{t('analytics.funnel.title', { n: days })}</Subhead>
      <div className="flex-1 overflow-y-auto pr-1 -mr-1">
        <div className="space-y-2.5">
          {steps.map(s => (
            <div key={s.key} className="flex items-center gap-3">
              <span className="w-10 text-[13px] font-mono font-bold text-right shrink-0" style={{ color: s.color }}>{s.label}</span>
              <div className="flex-1 h-7 bg-dark-700/50 border border-accent-green/10 overflow-hidden"
                style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}>
                <div className="h-full flex items-center justify-end pr-2 transition-all duration-700"
                  style={{
                    width: `${Math.max((s.value / total) * 100, s.value > 0 ? 4 : 0)}%`,
                    background: `linear-gradient(90deg, ${s.color}30, ${s.color})`,
                    boxShadow: `inset 0 0 10px ${s.color}50`,
                    minWidth: s.value > 0 ? 32 : 0,
                  }}>
                  {s.value > 0 && <span className="text-[13px] font-mono font-bold text-white drop-shadow">{s.value}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {data.filter_breakdown.length > 0 && (
          <div className="mt-4 pt-4 border-t border-accent-green/15">
            <div className="cp-section-label !text-[13px] !font-bold !mb-2">{t('analytics.funnel.top_reasons')}</div>
            <div className="space-y-1">
              {data.filter_breakdown.slice(0, 4).map(r => (
                <div key={r.reason} className="flex items-center justify-between text-[13px] font-mono">
                  <span className="text-gray-400 font-semibold truncate mr-2">{translateReason(t, r.reason)}</span>
                  <span className="text-accent-green font-bold shrink-0">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ── 链分布 ───────────────────────────────────────────────────────────
function ChainDistributionCard({ days, portfolio = null, cardRef }) {
  const { t } = useTranslation()
  const [data, setData] = useState([])
  useEffect(() => { fetchJson(`/api/analytics/chain_distribution?days=${days}`).then(setData).catch(() => {}) }, [days])

  const balanceByChain = {}
  for (const c of portfolio?.chains || []) {
    balanceByChain[c.chain] = c
  }
  // 包括只有余额没有信号分布的链
  const allChains = Array.from(new Set([
    ...data.map(d => d.chain),
    ...(portfolio?.chains || []).map(c => c.chain),
  ]))
  const distByChain = {}
  for (const d of data) distByChain[d.chain] = d

  return (
    <div ref={cardRef}>
      <Card className="cp-cfg-card">
        <Subhead>{t('analytics.chain.title', { n: days })}</Subhead>
        {allChains.length === 0 ? <EmptyState /> : (
          <>
            {data.length > 0 && (
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={data.map(d => ({ name: d.chain, value: d.total }))}
                    cx="50%" cy="50%" innerRadius={38} outerRadius={65}
                    paddingAngle={3} dataKey="value">
                    {data.map(d => (
                      <Cell key={d.chain} fill={CHAIN_COLORS[d.chain] || '#6B7280'} stroke="rgba(8,13,11,0.9)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: '#7effc2' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="space-y-1.5 mt-3">
              {allChains.map(chain => {
                const d = distByChain[chain]
                const b = balanceByChain[chain]
                const color = CHAIN_COLORS[chain] || '#6B7280'
                return (
                  <div key={chain} className="cp-filter-row !grid-cols-1 !p-0">
                    <div className="flex items-center gap-2 px-2.5 py-2 text-[13px] font-mono font-semibold flex-wrap">
                      <span
                        className="text-[12px] font-bold font-mono px-2 py-0.5 shrink-0"
                        style={{
                          background: color + '20',
                          color,
                          border: `1px solid ${color}50`,
                          clipPath: 'polygon(3px 0, 100% 0, calc(100% - 3px) 100%, 0 100%)',
                          textShadow: `0 0 6px ${color}80`,
                        }}
                      >
                        {chain}
                      </span>
                      {d ? (
                        <>
                          <span className="text-gray-400 tabular-nums">{t('analytics.chain.received_unit', { n: d.total })}</span>
                          <span className="text-accent-green font-bold tabular-nums">{t('analytics.chain.bought_unit', { n: d.bought })}</span>
                        </>
                      ) : (
                        <span className="text-gray-500 tracking-wider">{t('analytics.chain.no_signals')}</span>
                      )}
                      {b && (
                        <span className="ml-auto flex items-center gap-2">
                          {b.native_balance != null && (
                            <span className="text-gray-200 tabular-nums">
                              {Number(b.native_balance).toFixed(3)}
                              <span className="text-[12px] font-bold text-gray-500 ml-1">{b.native_symbol}</span>
                            </span>
                          )}
                          {b.usdt_balance != null && (
                            <span className="text-accent-green font-bold tabular-nums" style={{ textShadow: '0 0 4px currentColor' }}>
                              {Number(b.usdt_balance).toFixed(2)}<span className="text-[12px] font-bold text-gray-500 ml-0.5">U</span>
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

// ── CA 战绩排行榜 ─────────────────────────────────────────────────────
const RANK_BADGES = ['🥇', '🥈', '🥉']

function ExitPills({ reasons }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(reasons).map(([r, cnt]) => {
        const isLoss = r === 'stop_loss'
        return (
          <span key={r} className={clsx('cp-pill !text-[12px] !font-bold',
            r === 'take_profit' ? 'cp-pill-green' :
            r === 'timeout'     ? 'cp-pill-yellow' :
            !isLoss             ? 'cp-pill-gray'   : ''
          )} style={isLoss ? { color: '#ff7d97', borderColor: '#ff7d97', background: 'rgba(255,45,85,0.08)' } : undefined}>
            {t(`analytics.exit_reason.${r}`, { defaultValue: r })}{cnt > 1 && ` ×${cnt}`}
          </span>
        )
      })}
    </div>
  )
}

function CaLeaderboardCard() {
  const { t } = useTranslation()
  const [period, setPeriod] = useState('today')
  const [sortBy, setSortBy] = useState('pnl')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    setLoading(true); setExpanded(null)
    fetch(`/api/analytics/ca_leaderboard?period=${period}&sort_by=${sortBy}&limit=30`)
      .then(r => r.json()).then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period, sortBy])

  const periodChips = [
    { key: 'today',     label: t('analytics.range.today') },
    { key: 'yesterday', label: t('analytics.range.yesterday') },
    { key: 'week',      label: t('analytics.range.week') },
    { key: 'month',     label: t('analytics.range.month') },
    { key: 'all',       label: t('analytics.range.all') },
  ]
  const sortChips = [
    { key: 'pnl',      label: t('analytics.ca_leaderboard.sort_pnl') },
    { key: 'win_rate', label: t('analytics.ca_leaderboard.sort_win_rate') },
    { key: 'best_pnl', label: t('analytics.ca_leaderboard.sort_best_pnl') },
    { key: 'count',    label: t('analytics.ca_leaderboard.sort_count') },
  ]

  return (
    <Card className="cp-cfg-card">
      {/* 控制栏 */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <Subhead>{t('analytics.ca_leaderboard.title')}</Subhead>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1">
            {periodChips.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                className={clsx('cp-chip !text-[13px] !font-bold !py-1', period === p.key && 'cp-chip-active')}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {sortChips.map(s => (
              <button key={s.key} onClick={() => setSortBy(s.key)}
                className={clsx('cp-chip !text-[13px] !font-bold !py-1', sortBy === s.key && 'cp-chip-active')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <LoadingState /> : data.length === 0 ? <EmptyState text={t('analytics.ca_leaderboard.no_trades')} /> : (
        <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '560px' }}>
          {data.map((row, idx) => {
            const isOpen = expanded === row.ca
            const isUp = row.total_pnl_usdt > 0
            const pnlColor = isUp ? '#00ff87' : '#ff2d55'
            return (
              <div key={row.ca + row.chain} className="cp-filter-row !grid-cols-1 !p-0 overflow-hidden">
                {/* 主行 */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  style={{ background: isOpen ? `linear-gradient(90deg, ${pnlColor}08, transparent)` : undefined }}
                  onClick={() => setExpanded(isOpen ? null : row.ca)}
                >
                  {/* 排名 */}
                  <span className="text-[15px] w-7 shrink-0 text-center">
                    {idx < 3 ? RANK_BADGES[idx] : <span className="text-gray-400 font-mono font-bold text-[13px]">{idx + 1}</span>}
                  </span>

                  {/* 链徽章 + 代币名 */}
                  <div className="flex items-center gap-2 w-32 shrink-0">
                    <span className="text-[12px] font-bold font-mono px-2 py-0.5"
                      style={{
                        background: (CHAIN_COLORS[row.chain] || '#6B7280') + '20',
                        color: CHAIN_COLORS[row.chain] || '#9CA3AF',
                        border: `1px solid ${CHAIN_COLORS[row.chain] || '#6B7280'}50`,
                        clipPath: 'polygon(3px 0, 100% 0, calc(100% - 3px) 100%, 0 100%)',
                      }}>
                      {row.chain}
                    </span>
                    <span className="text-gray-100 font-bold text-[14px] truncate">
                      {row.symbol || row.token_name || row.ca.slice(0, 6) + '…'}
                    </span>
                  </div>

                  {/* 出局原因 */}
                  <div className="flex-1 min-w-0">
                    <ExitPills reasons={row.exit_reasons} />
                  </div>

                  {/* 胜率条 */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-14 h-1.5 bg-dark-700/80 overflow-hidden"
                      style={{ clipPath: 'polygon(2px 0, 100% 0, calc(100% - 2px) 100%, 0 100%)' }}>
                      <div className="h-full"
                        style={{
                          width: `${row.win_rate}%`,
                          background: row.win_rate >= 60 ? 'linear-gradient(90deg,#00ff8780,#00ff87)' :
                                       row.win_rate >= 40 ? 'linear-gradient(90deg,#ffe60080,#ffe600)' :
                                                            'linear-gradient(90deg,#ff2d5580,#ff2d55)',
                        }} />
                    </div>
                    <span className={clsx('text-[13px] font-mono font-bold w-10', rateColor(row.win_rate))}>
                      {row.win_rate.toFixed(0)}%
                    </span>
                  </div>

                  {/* P&L */}
                  <div className="text-right shrink-0 w-24">
                    <div className={clsx('text-[15px] font-mono font-bold', isUp ? 'text-accent-green' : 'text-accent-red')}
                      style={{ textShadow: `0 0 6px ${pnlColor}80` }}>
                      {isUp ? '+' : ''}{row.total_pnl_usdt.toFixed(2)}U
                    </div>
                    <div className="text-[12px] font-bold text-gray-400 font-mono">{t('analytics.ca_leaderboard.trades_unit', { n: row.trade_count })}</div>
                  </div>

                  <span className={clsx('text-accent-green/50 text-xs shrink-0 transition-transform', isOpen && 'rotate-180')}>▼</span>
                </div>

                {/* 展开：交易明细 */}
                {isOpen && (
                  <div className="cp-expanded px-4 py-3 border-t border-accent-green/15">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 叙事摘要 */}
                      {row.narrative && (
                        <div className="space-y-1.5">
                          <div className="cp-section-label !text-[13px] !font-bold">{t('analytics.ca_leaderboard.buy_data')}</div>
                          {[
                            row.narrative.market_cap > 0 && [t('analytics.ca_leaderboard.market_cap'), fmtCap(row.narrative.market_cap), 'text-gray-200'],
                            row.narrative.qwfc > 0 && [t('analytics.ca_leaderboard.qwfc'), row.narrative.qwfc, 'text-accent-blue'],
                            row.narrative.sender_win_rate > 0 && [t('analytics.ca_leaderboard.sender_win_rate'), row.narrative.sender_win_rate.toFixed(0) + '%', rateColor(row.narrative.sender_win_rate)],
                            row.narrative.risk_score > 0 && [t('analytics.ca_leaderboard.risk_score'), row.narrative.risk_score, row.narrative.risk_score >= 70 ? 'text-accent-red' : 'text-accent-yellow'],
                          ].filter(Boolean).map(([k, v, c]) => (
                            <div key={k} className="flex justify-between text-[13px] font-mono font-semibold">
                              <span className="text-gray-400">{k}</span>
                              <span className={clsx('font-bold', c)}>{v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* 交易明细 */}
                      <div>
                        <div className="cp-section-label !text-[13px] !font-bold">{t('analytics.ca_leaderboard.trade_detail')}</div>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {row.trades.map(tr => (
                            <div key={tr.id} className="flex items-center gap-2 text-[13px] font-mono py-1 border-b border-accent-green/8">
                              <span className="text-gray-400 font-semibold w-24 shrink-0">
                                {new Date(tr.close_time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                              </span>
                              <span className={clsx('font-bold w-16 shrink-0', tr.pnl_usdt > 0 ? 'text-accent-green' : 'text-accent-red')}>
                                {tr.pnl_usdt > 0 ? '+' : ''}{tr.pnl_usdt.toFixed(2)}U
                              </span>
                              <span className="text-gray-400 font-semibold">{t(`analytics.exit_reason.${tr.reason}`, { defaultValue: tr.reason })}</span>
                              {tr.sell_tx && (
                                <a href={(CHAIN_EXPLORER_TX[row.chain] || (tx => `https://bscscan.com/tx/${tx}`))(tr.sell_tx)}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-accent-blue font-bold hover:text-accent-green ml-auto"
                                  onClick={e => e.stopPropagation()}>Tx ↗</a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

// ── 发币人排行 ───────────────────────────────────────────────────────
function SenderLeaderboardCard({ days, syncHeight }) {
  const { t } = useTranslation()
  const [data, setData] = useState([])
  const [sort, setSort] = useState('total_pushed')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchJson(`/api/analytics/sender_leaderboard?limit=20&sort_by=${sort}&days=${days}`)
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [sort, days])

  const senderSorts = [
    { value: 'total_pushed',   label: t('analytics.sender.sort_pushed') },
    { value: 'ws_win_rate',    label: t('analytics.sender.sort_win_rate') },
    { value: 'total_pnl_usdt', label: t('analytics.sender.sort_pnl') },
  ]

  const cardStyle = syncHeight ? { height: syncHeight } : undefined
  const cardClass = clsx('cp-cfg-card flex flex-col', syncHeight && 'overflow-hidden')

  return (
    <Card className={cardClass} style={cardStyle}>
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <Subhead>{t('analytics.sender.title', { n: days })}</Subhead>
        <div className="flex gap-1">
          {senderSorts.map(s => (
            <button key={s.value} onClick={() => setSort(s.value)}
              className={clsx('cp-chip !text-[13px] !font-bold !py-1', sort === s.value && 'cp-chip-active')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <LoadingState /> : data.length === 0 ? <EmptyState /> : (
        <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-1.5">
          {data.slice(0, 15).map((r, i) => (
            <div key={r.sender} className="cp-filter-row !grid-cols-1 !p-0">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <span className="text-[13px] font-mono font-bold text-gray-400 w-5 shrink-0">{i + 1}</span>
                <span className="cp-pill cp-pill-yellow !text-[12px] !font-bold shrink-0">#{shortHash(r.sender)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 text-[13px] font-mono font-semibold">
                    <span className="text-gray-300">{t('analytics.sender.pushed_unit', { n: r.total_pushed })}</span>
                    {r.total_bought > 0 && <span className="text-accent-green font-bold">{t('analytics.sender.bought_unit', { n: r.total_bought })}</span>}
                    {r.ws_win_rate > 0 && (
                      <span className={clsx('font-bold', rateColor(r.ws_win_rate))}>{r.ws_win_rate}%</span>
                    )}
                  </div>
                </div>
                {r.win_count + r.loss_count > 0 && (
                  <div className={clsx('text-[14px] font-mono font-bold shrink-0',
                    r.total_pnl_usdt > 0 ? 'text-accent-green' : r.total_pnl_usdt < 0 ? 'text-accent-red' : 'text-gray-400'
                  )}>
                    {r.total_pnl_usdt >= 0 ? '+' : ''}{r.total_pnl_usdt}U
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── CA 流水 ──────────────────────────────────────────────────────────
function CaFeedTable({ days }) {
  const { t } = useTranslation()
  const [data, setData] = useState({ total: 0, data: [] })
  const [page, setPage] = useState(1)
  const [filterPassed, setFilterPassed] = useState('')
  const [bought, setBought] = useState('')
  const [selectedCA, setSelectedCA] = useState(null)

  const load = useCallback(() => {
    const p = new URLSearchParams({ page, page_size: 20, days, ...(filterPassed ? { filter_passed: filterPassed } : {}), ...(bought ? { bought } : {}) })
    fetchJson(`/api/analytics/ca_feed?${p}`).then(setData).catch(() => {})
  }, [page, filterPassed, bought, days])

  useEffect(() => { load() }, [load])

  const filterChips = [
    { label: t('analytics.feed.filter_all'),     val: '',      state: filterPassed, set: setFilterPassed },
    { label: t('analytics.feed.filter_passed'),  val: 'true',  state: filterPassed, set: setFilterPassed },
    { label: t('analytics.feed.filter_blocked'), val: 'false', state: filterPassed, set: setFilterPassed },
  ]
  const boughtChips = [
    { label: t('analytics.feed.bought_all'), val: '',      state: bought, set: setBought },
    { label: t('analytics.feed.bought_yes'), val: 'true',  state: bought, set: setBought },
    { label: t('analytics.feed.bought_no'),  val: 'false', state: bought, set: setBought },
  ]

  return (
    <Card className="cp-cfg-card">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <Subhead>{t('analytics.feed.title', { n: days })} <span className="ml-2 text-[13px] font-bold text-gray-400 normal-case tracking-normal">{t('analytics.feed.total_count', { n: data.total })}</span></Subhead>
        <div className="flex gap-3 flex-wrap">
          <div className="flex gap-1">
            {filterChips.map(c => (
              <button key={c.label} onClick={() => { c.set(c.val); setPage(1) }}
                className={clsx('cp-chip !text-[13px] !font-bold !py-1', c.state === c.val && 'cp-chip-active')}>{c.label}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {boughtChips.map(c => (
              <button key={c.label} onClick={() => { c.set(c.val); setPage(1) }}
                className={clsx('cp-chip !text-[13px] !font-bold !py-1', c.state === c.val && 'cp-chip-active')}>{c.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: '420px' }}>
        {data.data.length === 0 ? <EmptyState /> : data.data.map(r => (
          <div key={r.id}
            className={clsx('cp-filter-row !grid-cols-1 !p-0', r.bought && 'cursor-pointer')}
            onClick={() => r.bought && r.position_id && setSelectedCA({ positionId: r.position_id, ca: r.ca })}>
            <div className="flex items-center gap-3 px-3 py-2.5">
              {/* 时间 */}
              <span className="text-[13px] font-mono font-semibold text-gray-400 w-24 shrink-0">
                {new Date(r.received_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
              {/* 链 */}
              <span className="text-[12px] font-bold font-mono px-2 py-0.5 shrink-0"
                style={{
                  background: (CHAIN_COLORS[r.chain] || '#6B7280') + '20',
                  color: CHAIN_COLORS[r.chain] || '#9CA3AF',
                  border: `1px solid ${CHAIN_COLORS[r.chain] || '#6B7280'}50`,
                  clipPath: 'polygon(3px 0, 100% 0, calc(100% - 3px) 100%, 0 100%)',
                }}>
                {r.chain}
              </span>
              {/* 代币 */}
              <span className="text-gray-100 font-bold text-[13px] w-20 truncate shrink-0">
                {r.symbol || r.token_name || '—'}
              </span>
              {/* 市值 + 倍数 */}
              <span className="text-[13px] font-mono font-semibold text-gray-300 hidden sm:block">
                {r.market_cap > 0 ? fmtCap(r.market_cap) : '—'}
              </span>
              {r.current_multiple > 0 && (
                <span className="text-[13px] font-mono text-accent-yellow font-bold hidden sm:block">
                  {r.current_multiple}x
                </span>
              )}
              {/* 热度 */}
              {r.qwfc > 0 && (
                <span className="text-[13px] font-mono font-bold text-accent-blue hidden md:block">{t('analytics.feed.heat', { n: r.qwfc })}</span>
              )}
              {/* 拦截原因 */}
              <span className="flex-1 text-[13px] font-mono font-semibold text-gray-400 truncate min-w-0 hidden lg:block">
                {translateReason(t, r.filter_reason)}
              </span>
              {/* 状态 */}
              <div className="shrink-0">
                {r.bought
                  ? <span className="cp-pill cp-pill-green !text-[12px] !font-bold">{t('analytics.feed.status_bought')}</span>
                  : r.filter_passed
                  ? <span className="cp-pill cp-pill-blue !text-[12px] !font-bold">{t('analytics.feed.status_passed')}</span>
                  : <span className="cp-pill !text-[12px] !font-bold" style={{ color: '#ff7d97', borderColor: '#ff7d97', background: 'rgba(255,45,85,0.08)' }}>{t('analytics.feed.status_blocked')}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
          className="cp-cfg-btn cp-cfg-btn-ghost !py-1.5 !px-4 !text-[13px] !font-bold disabled:opacity-30">{t('analytics.feed.prev_page')}</button>
        <span className="text-[13px] font-mono font-bold text-accent-green/70 tracking-widest">{t('analytics.feed.page_of', { n: page })}</span>
        <button disabled={data.data.length < 20} onClick={() => setPage(p => p + 1)}
          className="cp-cfg-btn cp-cfg-btn-ghost !py-1.5 !px-4 !text-[13px] !font-bold disabled:opacity-30">{t('analytics.feed.next_page')}</button>
      </div>

      {selectedCA && (
        <PriceCurveModal positionId={selectedCA.positionId} ca={selectedCA.ca} onClose={() => setSelectedCA(null)} />
      )}
    </Card>
  )
}

// ── 价格曲线弹窗 ──────────────────────────────────────────────────────
function PriceCurveModal({ positionId, ca, onClose }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  useEffect(() => { fetchJson(`/api/analytics/price_curve/${positionId}`).then(setData).catch(() => {}) }, [positionId])

  const chartData = data?.snapshots?.map(s => ({
    time: new Date(s.timestamp).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }),
    price: s.price,
    event: s.event_type,
  })) || []

  return (
    <div className="cp-modal-backdrop fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="web3-frame w-full max-w-xl mx-4" onClick={e => e.stopPropagation()}>
        <span className="w3-corners" aria-hidden="true"><i></i></span>
        <div className="web3-frame-inner cp-modal-bg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="cp-modal-title !text-[15px] !mb-0">{t('analytics.price_curve.title', { ca: (ca?.slice(0, 10) || '') + '…' })}</h3>
            <button onClick={onClose} className="cp-modal-close">×</button>
          </div>
          <div className="cp-modal-divider mb-4" />
          {!data ? <LoadingState /> : chartData.length === 0 ? <EmptyState text={t('analytics.price_curve.no_snapshots')} /> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="time" tick={CHART_TICK} stroke="rgba(0,255,135,0.15)" />
                <YAxis tick={CHART_TICK} tickFormatter={v => v.toExponential(2)} width={58} stroke="rgba(0,255,135,0.15)" />
                <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: '#7effc2' }}
                  formatter={v => [typeof v === 'number' ? v.toPrecision(5) : v]} />
                <Line type="monotone" dataKey="price" stroke="#00d4ff" dot={false} strokeWidth={2} name={t('analytics.price_curve.price')}
                  filter="drop-shadow(0 0 4px rgba(0,212,255,0.6))" />
                {chartData.filter(d => d.event === 'buy').map((p, i) => (
                  <ReferenceDot key={'b' + i} x={p.time} y={p.price} r={5} fill="#00ff87" stroke="#fff" strokeWidth={1.5} />
                ))}
                {chartData.filter(d => d.event === 'sell').map((p, i) => (
                  <ReferenceDot key={'s' + i} x={p.time} y={p.price} r={5} fill="#ff2d55" stroke="#fff" strokeWidth={1.5} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          {data?.position && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                [t('analytics.price_curve.entry_price'), data.position.entry_price?.toPrecision(5), 'text-accent-blue'],
                [t('analytics.price_curve.amount'),      data.position.amount_usdt + 'U',          'text-accent-green'],
                [t('analytics.price_curve.status'),      data.position.status, data.position.status === 'open' ? 'text-accent-green' : 'text-gray-400'],
              ].map(([k, v, c]) => (
                <div key={k} className="cp-stat-panel !p-2.5 text-center">
                  <div className="cp-stat-key !text-[12px] !font-bold">{k}</div>
                  <div className={clsx('cp-stat-val !text-[14px] mt-0.5', c)}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 主面板 ────────────────────────────────────────────────────────────
export default function AnalyticsPanel({ posCount = 0 }) {
  const { t } = useTranslation()
  const [days, setDays] = useState(7)
  const [positions, setPositions] = useState([])
  const [portfolio, setPortfolio] = useState(null)
  const [chainHeight, setChainHeight] = useState(null)
  const chainRef = useRef(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [posResp, pfResp] = await Promise.all([
          fetch('/api/positions').then(r => r.ok ? r.json() : []),
          fetch('/api/analytics/portfolio').then(r => r.ok ? r.json() : null),
        ])
        if (!alive) return
        setPositions(Array.isArray(posResp) ? posResp : [])
        setPortfolio(pfResp)
      } catch {}
    }
    load()
    const interval = setInterval(load, 15000)
    return () => { alive = false; clearInterval(interval) }
  }, [])

  // 让 信号漏斗 / 发币人排行 的高度 = 链分布 卡片高度
  useEffect(() => {
    if (!chainRef.current || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const h = entry.contentRect?.height
        if (h && Math.abs(h - (chainHeight || 0)) > 1) setChainHeight(Math.round(h))
      }
    })
    ro.observe(chainRef.current)
    return () => ro.disconnect()
  }, [chainHeight])

  return (
    <div className="cp-cfg-page !pb-12">
      <header className="cp-cfg-topbar">
        <div>
          <h2 className="cp-modal-title !text-[22px] !mb-0">{t('analytics.page_title')}</h2>
          <p className="cp-modal-subtitle !text-[13px] !normal-case !text-gray-300 !font-semibold mt-1">{t('analytics.past_days', { n: days })}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] text-gray-300 font-mono font-bold tracking-widest">{t('analytics.range_label')}</span>
          {[1, 7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={clsx(
                'text-[13px] font-bold px-3 py-1 rounded border transition-all font-mono',
                days === d
                  ? 'border-accent-green/50 text-accent-green bg-accent-green/10'
                  : 'border-dark-500 text-gray-300 hover:text-gray-100 hover:border-dark-400'
              )}
            >
              {d === 1 ? '1D' : `${d}D`}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-5">
        {/* P&L 曲线 — 全宽主 KPI（含实时钱包总览） */}
        <PnlCurveCard days={days} positions={positions} portfolio={portfolio} posCount={posCount} />

        {/* 漏斗 + 链分布 + 发币人 — 三栏；漏斗与发币人高度跟随链分布 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
          <FunnelCard days={days} syncHeight={chainHeight} />
          <ChainDistributionCard days={days} portfolio={portfolio} cardRef={chainRef} />
          <SenderLeaderboardCard days={days} syncHeight={chainHeight} />
        </div>

        {/* CA 战绩排行 — 全宽卡片列表 */}
        <CaLeaderboardCard />

        {/* CA 流水 — 全宽 */}
        <CaFeedTable days={days} />
      </div>
    </div>
  )
}

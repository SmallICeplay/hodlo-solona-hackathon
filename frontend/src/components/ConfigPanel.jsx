import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getConfig, updateConfig, getTradeHistory, getTradeStats } from '../api'
import { Card, Toggle } from './UI'
import WalletModal from './WalletModal'
import { clsx } from 'clsx'

const CHAIN_OPTIONS = ['SOL', 'BSC', 'ETH', 'XLAYER']

const FILTER_DEFAULTS = {
  spend_limit_enabled: 'false',
  spend_limit_usdt: '50',
  spend_limit_hours: '24',
  ca_repeat_buy_enabled: 'false',
  ca_repeat_qwfc_delta: '20',
  filter_sender_win_rate_enabled: 'false',
  filter_sender_win_rate_min: '60',
  filter_sender_group_win_rate_enabled: 'false',
  filter_sender_group_win_rate_min: '60',
  filter_sender_total_tokens_enabled: 'false',
  filter_sender_total_tokens_min: '5',
  filter_sender_best_multiple_enabled: 'false',
  filter_sender_best_multiple_min: '10',
  filter_new_sender_action: 'skip',
  filter_current_multiple_enabled: 'false',
  filter_current_multiple_max: '3',
  filter_qwfc_enabled: 'false',
  filter_qwfc_min: '3',
  filter_bqfc_enabled: 'false',
  filter_bqfc_min: '2',
  filter_fgq_enabled: 'false',
  filter_fgq_min: '2',
  filter_grcxcs_enabled: 'false',
  filter_grcxcs_min: '1',
  filter_market_cap_enabled: 'false',
  filter_market_cap_min: '10000',
  filter_market_cap_max: '5000000',
  filter_price_change_5m_enabled: 'false',
  filter_price_change_5m_min: '0',
  filter_buy_volume_1h_enabled: 'false',
  filter_buy_volume_1h_min: '1000',
  filter_holders_enabled: 'false',
  filter_holders_min: '50',
  filter_honeypot_enabled: 'true',
  filter_honeypot_unknown_action: 'skip',
  filter_mintable_enabled: 'true',
  filter_risk_score_enabled: 'false',
  filter_risk_score_max: '70',
  filter_max_holder_pct_enabled: 'false',
  filter_max_holder_pct_max: '90',
}

// ── Inline SVG icons (replace emojis) ────────────────────────────────
function Icon({ name, className = 'w-4 h-4' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    lock:   <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    bolt:   <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    link:   <><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></>,
    alert:  <><path d="M12 2 1 21h22L12 2z"/><line x1="12" y1="9"  x2="12" y2="14"/><line x1="12" y1="18" x2="12" y2="18"/></>,
    check:  <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    shield: <><path d="M12 2 3 6v6c0 5 4 9 9 10 5-1 9-5 9-10V6l-9-4z"/></>,
    clock:  <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    pointer:<><path d="M9 11V5a2 2 0 0 1 4 0v8"/><path d="M13 13V8a2 2 0 0 1 4 0v9"/><path d="M17 12V9a2 2 0 0 1 4 0v8a5 5 0 0 1-5 5h-3a6 6 0 0 1-6-6V7a2 2 0 0 1 4 0v6"/></>,
    skull:  <><path d="M8 22v-3l-2-1V14a6 6 0 1 1 12 0v4l-2 1v3"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><line x1="12" y1="17" x2="12" y2="20"/></>,
    save:   <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
    chevron:<polyline points="9 18 15 12 9 6"/>,
    info:   <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
  }
  return (
    <svg viewBox="0 0 24 24" className={className} {...common}>{paths[name] || null}</svg>
  )
}

// Section header — matches FollowModal title/subtitle scale
function SectionHeader({ title, desc, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex-1 min-w-0">
        <h3 className="cp-modal-title !text-[17px] !mb-0">{title}</h3>
        {desc && <p className="cp-modal-subtitle !normal-case !text-[14px] !text-gray-300 mt-2 !font-semibold !tracking-wide">{desc}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// Cyberpunk-styled number input wrapper — uses cp-modal-label (matches FollowModal)
function NumberInput({ label, value, onChange, min, max, step = 1, hint, disabled }) {
  return (
    <div>
      <label className="cp-modal-label">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className={clsx('cp-input', disabled && 'opacity-40 cursor-not-allowed')}
      />
      {hint && <p className="cp-hint">{hint}</p>}
    </div>
  )
}

// One row in a filter list — checkbox-style toggle, label, value input
function FilterRow({ label, enabled, onToggle, value, onChange, unit, min, max, step = 1, hint }) {
  return (
    <div className={clsx('cp-filter-row', !enabled && 'cp-filter-row-disabled')}>
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className={clsx('cp-checkbox shrink-0', enabled && 'cp-checkbox-on')}
        aria-pressed={enabled}
      >
        {enabled && <Icon name="check" className="w-3 h-3 text-accent-green" />}
      </button>
      <label
        onClick={() => onToggle(!enabled)}
        className="cp-filter-label cursor-pointer flex-1 min-w-0"
      >
        {label}
      </label>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={!enabled}
          min={min} max={max} step={step}
          className={clsx('cp-input !w-28 !py-1.5', !enabled && 'opacity-40 cursor-not-allowed')}
        />
        <span className="text-sm font-mono text-accent-green/70 tracking-wide w-10 text-left">{unit}</span>
      </div>
      {hint && <p className="cp-filter-hint">{hint}</p>}
    </div>
  )
}

// Compact info banner with leading icon
function InfoBanner({ icon, tone, children }) {
  const tones = {
    green:   'border-accent-green/40 bg-accent-green/8 text-accent-green',
    yellow:  'border-accent-yellow/40 bg-accent-yellow/8 text-accent-yellow',
    blue:    'border-accent-blue/40 bg-accent-blue/8 text-accent-blue',
    magenta: 'border-accent-purple/40 bg-accent-purple/8 text-accent-purple',
    gray:    'border-dark-500 bg-dark-700/40 text-gray-500',
  }
  return (
    <div className={clsx('cp-info-banner', tones[tone] || tones.gray)}>
      {icon && <Icon name={icon} className="w-3.5 h-3.5 shrink-0" />}
      <span className="text-[14px] font-bold font-mono tracking-wide leading-relaxed">{children}</span>
    </div>
  )
}

// Sub-card for nested toggle blocks
function Subcard({ children, dim }) {
  return (
    <div className={clsx('cp-stat-panel !p-4 mt-4', dim && 'opacity-50')}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
export default function ConfigPanel({ onConfigSaved }) {
  const { t } = useTranslation()
  const [cfg, setCfg] = useState({
    bot_enabled: 'false',
    auto_buy_enabled: 'false',
    leaderboard_batch_follow_enabled: 'false',
    buy_amount_usdt: '2',
    take_profit_pct: '50',
    stop_loss_pct: '30',
    max_hold_minutes: '60',
    max_concurrent_positions: '5',
    enabled_chains: 'SOL,BSC,ETH,XLAYER',
    price_poll_interval: '10',
    position_price_source: 'cached',
    gas_price_multiplier: '1.0',
    approve_gas_price_gwei: '1.0',
    broadcast_mode: 'ave',
    buy_amount_fallback_enabled: 'true',
    buy_amount_fallback_usdt: '1',
    buy_precheck_enabled: 'true',
    buy_fail_cooldown_seconds: '300',
    buy_with_bnb_fallback_enabled: 'false',
    ave_trade_api_key: '',
    ave_trade_api_url: 'https://bot-api.ave.ai',
    ave_data_api_key: 'SW59NmZFRG2yfRSSWvKlzTuAuZBFl5SUUCV2DUX5rg5eK8n6sipMlLkwXCX5qHGw',
    ave_data_api_url: 'https://ave-api.cloud',
    ...FILTER_DEFAULTS,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [walletOpen, setWalletOpen] = useState(false)

  useEffect(() => {
    getConfig().then(data => setCfg(prev => ({ ...prev, ...data }))).catch(() => {})
  }, [])

  const set = (key, val) => setCfg(prev => ({ ...prev, [key]: val }))
  const setEnabled = (key, v) => set(key, v ? 'true' : 'false')
  const isEnabled = (key) => cfg[key] === 'true'

  const toggleChain = (chain) => {
    const current = cfg.enabled_chains.split(',').filter(Boolean)
    const next = current.includes(chain)
      ? current.filter(c => c !== chain)
      : [...current, chain]
    set('enabled_chains', next.join(','))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateConfig(cfg)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onConfigSaved?.()
    } catch (e) {
      alert(t('config.save_failed') + ': ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const enabledChainsArr = cfg.enabled_chains.split(',').filter(Boolean)
  const botEnabled = cfg.bot_enabled === 'true'

  // Status line at top of bot card
  const statusLine = botEnabled
    ? cfg.auto_buy_enabled === 'true'
      ? <InfoBanner icon="bolt" tone="yellow">{t('config.bot.status_auto')}</InfoBanner>
      : <InfoBanner icon="link" tone="blue">{t('config.bot.status_follow')}</InfoBanner>
    : <InfoBanner icon="alert" tone="yellow">{t('config.bot.status_paused')}</InfoBanner>

  return (
    <div className="cp-cfg-page">
      {/* Sticky top bar: title + actions */}
      <header className="cp-cfg-topbar">
        <div className="min-w-0">
          <h2 className="cp-modal-title !text-[22px] !mb-0 truncate">{t('config.page_title')}</h2>
          <p className="cp-modal-subtitle !text-[13px] !normal-case !text-gray-300 !font-semibold mt-1 truncate">{t('config.page_subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setWalletOpen(true)}
            className="cp-cfg-btn cp-cfg-btn-ghost"
            title={t('config.wallet_link.title')}
          >
            <Icon name="lock" className="w-3.5 h-3.5" />
            <span>{t('config.wallet_link.title')}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={clsx('cp-cfg-btn cp-cfg-btn-primary', saved && 'cp-cfg-btn-saved')}
          >
            <Icon name={saved ? 'check' : 'save'} className="w-3.5 h-3.5" />
            <span>{saving ? t('config.saving') : saved ? t('config.saved') : t('config.save_btn')}</span>
          </button>
        </div>
      </header>

      <div className="cp-cfg-grid">
      {/* ──────── Column 1: Status & Interface ──────── */}
      <div className="cp-cfg-col">
        <div className="cp-cfg-col-head">{t('config.col_status')}</div>

        {/* ── Bot status ── */}
        <Card className="cp-cfg-card">
          <SectionHeader
            title={t('config.bot.title')}
            desc={t('config.bot.desc')}
            action={<Toggle checked={botEnabled} onChange={(v) => set('bot_enabled', v ? 'true' : 'false')} />}
          />
          <div className={clsx('cp-cfg-divided-rows', !botEnabled && 'opacity-40 pointer-events-none')}>
            <div className="cp-cfg-row">
              <div className="flex-1 min-w-0">
                <p className="cp-modal-label !mb-1">{t('config.bot.auto_buy')}</p>
                <p className="cp-hint">{t('config.bot.auto_buy_desc')}</p>
              </div>
              <Toggle
                checked={cfg.auto_buy_enabled === 'true'}
                onChange={(v) => set('auto_buy_enabled', v ? 'true' : 'false')}
              />
            </div>
            <div className="cp-cfg-row">
              <div className="flex-1 min-w-0">
                <p className="cp-modal-label !mb-1">{t('config.bot.batch_follow')}</p>
                <p className="cp-hint">{t('config.bot.batch_follow_desc')}</p>
              </div>
              <Toggle
                checked={cfg.leaderboard_batch_follow_enabled === 'true'}
                onChange={(v) => set('leaderboard_batch_follow_enabled', v ? 'true' : 'false')}
              />
            </div>
          </div>
          <div className="mt-4">{statusLine}</div>
        </Card>

        {/* ── API config ── */}
        <Card className="cp-cfg-card">
          <SectionHeader title={t('config.api.title')} desc={t('config.api.desc')} />
          <div className="grid md:grid-cols-2 gap-5">
            <ApiKeyBlock
              title={t('config.api.trade_title')}
              badge={t('config.api.trade_badge')}
              tone="yellow"
              value={cfg.ave_trade_api_key}
              onChangeKey={v => set('ave_trade_api_key', v)}
              urlValue={cfg.ave_trade_api_url}
              onChangeUrl={v => set('ave_trade_api_url', v)}
              keyPlaceholder={t('config.api.key_placeholder_trade')}
              keyLabel={t('config.api.key')}
              urlLabel={t('config.api.base_url')}
              setLabel={t('config.api.key_set')}
            />
            <ApiKeyBlock
              title={t('config.api.data_title')}
              badge={t('config.api.data_badge')}
              tone="blue"
              value={cfg.ave_data_api_key}
              onChangeKey={v => set('ave_data_api_key', v)}
              urlValue={cfg.ave_data_api_url}
              onChangeUrl={v => set('ave_data_api_url', v)}
              keyPlaceholder={t('config.api.key_placeholder_data')}
              keyLabel={t('config.api.key')}
              urlLabel={t('config.api.base_url')}
              setLabel={t('config.api.key_set')}
            />
          </div>
        </Card>

      </div>
      {/* ──────── Column 2: Trade & Chain ──────── */}
      <div className="cp-cfg-col">
        <div className="cp-cfg-col-head">{t('config.col_trade')}</div>

        {/* ── Trade params ── */}
        <Card className="cp-cfg-card">
          <SectionHeader title={t('config.trade.title')} />
          <div className="grid md:grid-cols-2 gap-5">
            <NumberInput
              label={t('config.trade.buy_amount')}
              value={cfg.buy_amount_usdt}
              onChange={v => set('buy_amount_usdt', v)}
              min={0.1} max={100} step={0.1}
              hint={t('config.trade.buy_amount_hint')}
            />
            <NumberInput
              label={t('config.trade.max_concurrent')}
              value={cfg.max_concurrent_positions}
              onChange={v => set('max_concurrent_positions', v)}
              min={1} max={20}
              hint={t('config.trade.max_concurrent_hint')}
            />
          </div>

          <Subcard>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="cp-modal-label !mb-1">{t('config.trade.fallback_title')}</p>
                <p className="cp-hint">{t('config.trade.fallback_desc')}</p>
              </div>
              <Toggle
                checked={cfg.buy_amount_fallback_enabled === 'true'}
                onChange={v => set('buy_amount_fallback_enabled', v ? 'true' : 'false')}
              />
            </div>
            {cfg.buy_amount_fallback_enabled === 'true' && (
              <div className="mt-4">
                <NumberInput
                  label={t('config.trade.fallback_amount')}
                  value={cfg.buy_amount_fallback_usdt}
                  onChange={v => set('buy_amount_fallback_usdt', v)}
                  min={1} max={100} step={0.5}
                  hint={t('config.trade.fallback_amount_hint', { base: cfg.buy_amount_usdt })}
                />
              </div>
            )}
          </Subcard>

          <Subcard>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <p className="cp-modal-label !mb-1">{t('config.trade.precheck_title')}</p>
                <p className="cp-hint">{t('config.trade.precheck_desc')}</p>
              </div>
              <Toggle
                checked={cfg.buy_precheck_enabled === 'true'}
                onChange={v => set('buy_precheck_enabled', v ? 'true' : 'false')}
              />
            </div>
            {cfg.buy_precheck_enabled === 'true'
              ? <InfoBanner icon="check" tone="green">{t('config.trade.precheck_on')}</InfoBanner>
              : <InfoBanner icon="alert" tone="yellow">{t('config.trade.precheck_off')}</InfoBanner>}
          </Subcard>

          <div className="mt-5">
            <NumberInput
              label={t('config.trade.cooldown')}
              value={cfg.buy_fail_cooldown_seconds}
              onChange={v => set('buy_fail_cooldown_seconds', v)}
              min={0} max={3600} step={30}
              hint={t('config.trade.cooldown_hint')}
            />
          </div>

          <Subcard>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                <p className="cp-modal-label !mb-1">{t('config.trade.bnb_title')}</p>
                <p className="cp-hint">{t('config.trade.bnb_desc')}</p>
              </div>
              <Toggle
                checked={cfg.buy_with_bnb_fallback_enabled === 'true'}
                onChange={v => set('buy_with_bnb_fallback_enabled', v ? 'true' : 'false')}
              />
            </div>
            {cfg.buy_with_bnb_fallback_enabled === 'true'
              ? <InfoBanner icon="check" tone="green">{t('config.trade.bnb_on')}</InfoBanner>
              : <InfoBanner icon="info" tone="gray">{t('config.trade.bnb_off')}</InfoBanner>}
          </Subcard>
        </Card>

        {/* ── Sell strategy ── */}
        <Card className="cp-cfg-card">
          <SectionHeader title={t('config.sell.title')} />
          <div className="grid md:grid-cols-3 gap-5">
            <NumberInput
              label={t('config.sell.tp')}
              value={cfg.take_profit_pct}
              onChange={v => set('take_profit_pct', v)}
              min={1} max={10000}
              hint={t('config.sell.tp_hint')}
            />
            <NumberInput
              label={t('config.sell.sl')}
              value={cfg.stop_loss_pct}
              onChange={v => set('stop_loss_pct', v)}
              min={1} max={100}
              hint={t('config.sell.sl_hint')}
            />
            <NumberInput
              label={t('config.sell.max_hold')}
              value={cfg.max_hold_minutes}
              onChange={v => set('max_hold_minutes', v)}
              min={1} max={1440}
              hint={t('config.sell.max_hold_hint')}
            />
          </div>
        </Card>

        {/* ── Spend limit ── */}
        <Card className="cp-cfg-card">
          <SectionHeader
            title={t('config.spend.title')}
            desc={t('config.spend.desc')}
            action={<Toggle checked={isEnabled('spend_limit_enabled')} onChange={v => setEnabled('spend_limit_enabled', v)} />}
          />
          <div className={clsx('grid md:grid-cols-2 gap-5', !isEnabled('spend_limit_enabled') && 'opacity-40')}>
            <NumberInput
              label={t('config.spend.limit')}
              value={cfg.spend_limit_usdt}
              onChange={v => set('spend_limit_usdt', v)}
              min={1} max={99999}
              hint={t('config.spend.limit_hint')}
              disabled={!isEnabled('spend_limit_enabled')}
            />
            <NumberInput
              label={t('config.spend.window')}
              value={cfg.spend_limit_hours}
              onChange={v => set('spend_limit_hours', v)}
              min={1} max={168}
              hint={t('config.spend.window_hint')}
              disabled={!isEnabled('spend_limit_enabled')}
            />
          </div>
        </Card>

        {/* ── Repeat-buy ── */}
        <Card className="cp-cfg-card">
          <SectionHeader title={t('config.repeat.title')} />
          <div className="cp-cfg-divided-rows">
            <div className="cp-cfg-row">
              <div className="flex-1 min-w-0">
                <p className="cp-modal-label !mb-1">{t('config.repeat.allow')}</p>
                <p className="cp-hint">{t('config.repeat.allow_desc')}</p>
              </div>
              <Toggle
                checked={cfg.ca_repeat_buy_enabled === 'true'}
                onChange={v => set('ca_repeat_buy_enabled', v ? 'true' : 'false')}
              />
            </div>
          </div>
          {cfg.ca_repeat_buy_enabled === 'true' && (
            <Subcard>
              <NumberInput
                label={t('config.repeat.delta')}
                value={cfg.ca_repeat_qwfc_delta}
                onChange={v => set('ca_repeat_qwfc_delta', v)}
                min={5} max={200} step={5}
                hint={t('config.repeat.delta_hint')}
              />
              <p className="cp-hint">{t('config.repeat.delta_example')}</p>
            </Subcard>
          )}
        </Card>

        {/* ── Chains + GAS + broadcast ── */}
        <Card className="cp-cfg-card">
          <SectionHeader title={t('config.chain.title')} />
          <div className="flex flex-wrap gap-3 mb-5">
            {CHAIN_OPTIONS.map(chain => (
              <button
                key={chain}
                onClick={() => toggleChain(chain)}
                className={clsx('cp-chip !px-5 !py-2 !text-[13px]', enabledChainsArr.includes(chain) && 'cp-chip-active')}
              >
                {chain}
              </button>
            ))}
          </div>
          <NumberInput
            label={t('config.chain.poll_interval')}
            value={cfg.price_poll_interval}
            onChange={v => set('price_poll_interval', v)}
            min={5} max={60}
            hint={t('config.chain.poll_interval_hint')}
          />

          <div className="mt-6 pt-5 border-t border-accent-green/15">
            <p className="cp-section-label !text-[12px] !mb-4">{t('config.chain.gas_title')}</p>
            <div className="grid md:grid-cols-2 gap-5">
              <NumberInput
                label={t('config.chain.swap_mult')}
                value={cfg.gas_price_multiplier}
                onChange={v => set('gas_price_multiplier', v)}
                min={0.1} max={5.0} step={0.1}
                hint={t('config.chain.swap_mult_hint')}
              />
              <NumberInput
                label={t('config.chain.approve_gwei')}
                value={cfg.approve_gas_price_gwei}
                onChange={v => set('approve_gas_price_gwei', v)}
                min={0.05} max={10.0} step={0.05}
                hint={t('config.chain.approve_gwei_hint')}
              />
            </div>

            <Subcard>
              <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="cp-modal-label !mb-1">{t('config.chain.broadcast_title')}</p>
                  <p className="cp-hint">{t('config.chain.broadcast_desc')}</p>
                </div>
                <div className="flex gap-2">
                  {[
                    { val: 'ave',    label: t('config.chain.broadcast_ave'),    desc: t('config.chain.broadcast_ave_desc') },
                    { val: 'direct', label: t('config.chain.broadcast_direct'), desc: t('config.chain.broadcast_direct_desc') },
                  ].map(m => (
                    <button
                      key={m.val}
                      onClick={() => set('broadcast_mode', m.val)}
                      title={m.desc}
                      className={clsx('cp-chip !text-[12px]', cfg.broadcast_mode === m.val && 'cp-chip-active')}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {cfg.broadcast_mode === 'direct'
                ? <InfoBanner icon="check" tone="green">{t('config.chain.broadcast_direct_note')}</InfoBanner>
                : <InfoBanner icon="info"  tone="gray">{t('config.chain.broadcast_ave_note')}</InfoBanner>}
            </Subcard>
          </div>
        </Card>
      </div>

      {/* ──────── Column 3: Filters ──────── */}
      <div className="cp-cfg-col">
        <div className="cp-cfg-col-head">{t('config.col_filter')}</div>

        {/* ── Filters (all 5 categories merged into one card) ── */}
        <Card className="cp-cfg-card">
          <SectionHeader title={t('config.sender.title').split(' · ')[0]} desc={t('config.sender.desc')} />

          {/* Sub-section: Sender quality */}
          <div className="cp-cfg-subhead">{t('config.sender.title').split(' · ')[1] || t('config.sender.title')}</div>
          <div className="cp-filter-list">
            <FilterRow
              label={t('config.sender.global_winrate')}
              enabled={isEnabled('filter_sender_win_rate_enabled')}
              onToggle={v => setEnabled('filter_sender_win_rate_enabled', v)}
              value={cfg.filter_sender_win_rate_min}
              onChange={v => set('filter_sender_win_rate_min', v)}
              unit={t('config.unit.pct')} min={1} max={100}
              hint={t('config.sender.global_winrate_hint')}
            />
            <FilterRow
              label={t('config.sender.group_winrate')}
              enabled={isEnabled('filter_sender_group_win_rate_enabled')}
              onToggle={v => setEnabled('filter_sender_group_win_rate_enabled', v)}
              value={cfg.filter_sender_group_win_rate_min}
              onChange={v => set('filter_sender_group_win_rate_min', v)}
              unit={t('config.unit.pct')} min={1} max={100}
              hint={t('config.sender.group_winrate_hint')}
            />
            <FilterRow
              label={t('config.sender.total_tokens')}
              enabled={isEnabled('filter_sender_total_tokens_enabled')}
              onToggle={v => setEnabled('filter_sender_total_tokens_enabled', v)}
              value={cfg.filter_sender_total_tokens_min}
              onChange={v => set('filter_sender_total_tokens_min', v)}
              unit={t('config.unit.count')} min={1} max={999}
              hint={t('config.sender.total_tokens_hint')}
            />
            <FilterRow
              label={t('config.sender.best_mult')}
              enabled={isEnabled('filter_sender_best_multiple_enabled')}
              onToggle={v => setEnabled('filter_sender_best_multiple_enabled', v)}
              value={cfg.filter_sender_best_multiple_min}
              onChange={v => set('filter_sender_best_multiple_min', v)}
              unit={t('config.unit.x')} min={1} max={10000}
              hint={t('config.sender.best_mult_hint')}
            />
          </div>
          <div className="mt-5">
            <p className="cp-modal-label !mb-3">{t('config.sender.new_sender')}</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: 'skip',  label: t('config.sender.new_skip'),  desc: t('config.sender.new_skip_desc') },
                { v: 'allow', label: t('config.sender.new_allow'), desc: t('config.sender.new_allow_desc') },
                { v: 'half',  label: t('config.sender.new_half'),  desc: t('config.sender.new_half_desc') },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => set('filter_new_sender_action', opt.v)}
                  className={clsx('cp-chip cp-chip-stack', cfg.filter_new_sender_action === opt.v && 'cp-chip-active')}
                >
                  <span>{opt.label}</span>
                  <span className="cp-chip-sub">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="cp-cfg-divider" />

          {/* Sub-section: Anti-FOMO */}
          <div className="cp-cfg-subhead">{t('config.anti_fomo.title').split(' · ')[1] || t('config.anti_fomo.title')}</div>
          <div className="cp-filter-list">
            <FilterRow
              label={t('config.anti_fomo.current_mult')}
              enabled={isEnabled('filter_current_multiple_enabled')}
              onToggle={v => setEnabled('filter_current_multiple_enabled', v)}
              value={cfg.filter_current_multiple_max}
              onChange={v => set('filter_current_multiple_max', v)}
              unit={t('config.unit.x')} min={0.1} max={100} step={0.1}
              hint={t('config.anti_fomo.current_mult_hint')}
            />
          </div>

          <div className="cp-cfg-divider" />

          {/* Sub-section: Heat */}
          <div className="cp-cfg-subhead">{t('config.heat.title').split(' · ')[1] || t('config.heat.title')}</div>
          <div className="cp-filter-list">
            <FilterRow
              label={t('config.heat.global_count')}
              enabled={isEnabled('filter_qwfc_enabled')}
              onToggle={v => setEnabled('filter_qwfc_enabled', v)}
              value={cfg.filter_qwfc_min}
              onChange={v => set('filter_qwfc_min', v)}
              unit={t('config.unit.times')} min={1} max={999}
              hint={t('config.heat.global_count_hint')}
            />
            <FilterRow
              label={t('config.heat.local_count')}
              enabled={isEnabled('filter_bqfc_enabled')}
              onToggle={v => setEnabled('filter_bqfc_enabled', v)}
              value={cfg.filter_bqfc_min}
              onChange={v => set('filter_bqfc_min', v)}
              unit={t('config.unit.times')} min={1} max={999}
              hint={t('config.heat.local_count_hint')}
            />
            <FilterRow
              label={t('config.heat.groups')}
              enabled={isEnabled('filter_fgq_enabled')}
              onToggle={v => setEnabled('filter_fgq_enabled', v)}
              value={cfg.filter_fgq_min}
              onChange={v => set('filter_fgq_min', v)}
              unit={t('config.unit.groups')} min={1} max={999}
              hint={t('config.heat.groups_hint')}
            />
            <FilterRow
              label={t('config.heat.queries')}
              enabled={isEnabled('filter_grcxcs_enabled')}
              onToggle={v => setEnabled('filter_grcxcs_enabled', v)}
              value={cfg.filter_grcxcs_min}
              onChange={v => set('filter_grcxcs_min', v)}
              unit={t('config.unit.times')} min={1} max={999}
              hint={t('config.heat.queries_hint')}
            />
          </div>

          <div className="cp-cfg-divider" />

          {/* Sub-section: Market data */}
          <div className="cp-cfg-subhead">{t('config.market.title').split(' · ')[1] || t('config.market.title')}</div>
          <div className={clsx('mb-4', !isEnabled('filter_market_cap_enabled') && 'opacity-60')}>
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => setEnabled('filter_market_cap_enabled', !isEnabled('filter_market_cap_enabled'))}
                className={clsx('cp-checkbox', isEnabled('filter_market_cap_enabled') && 'cp-checkbox-on')}
              >
                {isEnabled('filter_market_cap_enabled') && <Icon name="check" className="w-3 h-3 text-accent-green" />}
              </button>
              <span className="cp-modal-label !mb-0">{t('config.market.mc_range')}</span>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <NumberInput
                label={t('config.market.mc_min')}
                value={cfg.filter_market_cap_min}
                onChange={v => set('filter_market_cap_min', v)}
                disabled={!isEnabled('filter_market_cap_enabled')}
              />
              <NumberInput
                label={t('config.market.mc_max')}
                value={cfg.filter_market_cap_max}
                onChange={v => set('filter_market_cap_max', v)}
                disabled={!isEnabled('filter_market_cap_enabled')}
              />
            </div>
          </div>
          <div className="cp-filter-list">
            <FilterRow
              label={t('config.market.price_5m')}
              enabled={isEnabled('filter_price_change_5m_enabled')}
              onToggle={v => setEnabled('filter_price_change_5m_enabled', v)}
              value={cfg.filter_price_change_5m_min}
              onChange={v => set('filter_price_change_5m_min', v)}
              unit={t('config.unit.pct')} min={-100} max={10000} step={1}
              hint={t('config.market.price_5m_hint')}
            />
            <FilterRow
              label={t('config.market.buy_vol')}
              enabled={isEnabled('filter_buy_volume_1h_enabled')}
              onToggle={v => setEnabled('filter_buy_volume_1h_enabled', v)}
              value={cfg.filter_buy_volume_1h_min}
              onChange={v => set('filter_buy_volume_1h_min', v)}
              unit={t('config.unit.u')} min={0} max={9999999}
              hint={t('config.market.buy_vol_hint')}
            />
            <FilterRow
              label={t('config.market.holders')}
              enabled={isEnabled('filter_holders_enabled')}
              onToggle={v => setEnabled('filter_holders_enabled', v)}
              value={cfg.filter_holders_min}
              onChange={v => set('filter_holders_min', v)}
              unit={t('config.unit.people')} min={1} max={99999}
              hint={t('config.market.holders_hint')}
            />
          </div>

          <div className="cp-cfg-divider" />

          {/* Sub-section: Safety */}
          <div className="cp-cfg-subhead">{t('config.safety.title').split(' · ')[1] || t('config.safety.title')}</div>
          <div className="cp-cfg-divided-rows">
            <div className="cp-cfg-row">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="cp-modal-label !mb-1">{t('config.safety.honeypot')}</p>
                  <code className="text-[12px] font-bold text-accent-red font-mono px-2 py-0.5 rounded border border-accent-red/40 bg-accent-red/10">is_honeypot=1</code>
                </div>
                <p className="cp-hint">{t('config.safety.honeypot_desc')}</p>
              </div>
              <Toggle
                checked={isEnabled('filter_honeypot_enabled')}
                onChange={v => setEnabled('filter_honeypot_enabled', v)}
              />
            </div>
            <div className="cp-cfg-row">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="cp-modal-label !mb-1">{t('config.safety.unknown')}</p>
                  <code className="text-[12px] font-bold text-accent-yellow font-mono px-2 py-0.5 rounded border border-accent-yellow/40 bg-accent-yellow/10">is_honeypot=-1</code>
                </div>
                <p className="cp-hint">{t('config.safety.unknown_desc')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-bold text-gray-200 font-mono tracking-wide uppercase">
                  {cfg.filter_honeypot_unknown_action === 'skip' ? t('config.safety.unknown_action_skip') : t('config.safety.unknown_action_allow')}
                </span>
                <Toggle
                  checked={cfg.filter_honeypot_unknown_action === 'skip'}
                  onChange={v => set('filter_honeypot_unknown_action', v ? 'skip' : 'allow')}
                />
              </div>
            </div>
            <div className="cp-cfg-row">
              <div className="flex-1 min-w-0">
                <p className="cp-modal-label !mb-1">{t('config.safety.mintable')}</p>
                <p className="cp-hint">{t('config.safety.mintable_desc')}</p>
              </div>
              <Toggle
                checked={isEnabled('filter_mintable_enabled')}
                onChange={v => setEnabled('filter_mintable_enabled', v)}
              />
            </div>
          </div>
          <div className="mt-3">
            {cfg.filter_honeypot_unknown_action === 'skip'
              ? <InfoBanner icon="alert" tone="gray">{t('config.safety.unknown_skip_warn')}</InfoBanner>
              : <InfoBanner icon="alert" tone="yellow">{t('config.safety.unknown_allow_warn')}</InfoBanner>}
          </div>
          <div className="cp-filter-list mt-4">
            <FilterRow
              label={t('config.safety.risk')}
              enabled={isEnabled('filter_risk_score_enabled')}
              onToggle={v => setEnabled('filter_risk_score_enabled', v)}
              value={cfg.filter_risk_score_max}
              onChange={v => set('filter_risk_score_max', v)}
              unit={t('config.unit.score')} min={1} max={100}
              hint={t('config.safety.risk_hint')}
            />
            <FilterRow
              label={t('config.safety.max_holder')}
              enabled={isEnabled('filter_max_holder_pct_enabled')}
              onToggle={v => setEnabled('filter_max_holder_pct_enabled', v)}
              value={cfg.filter_max_holder_pct_max}
              onChange={v => set('filter_max_holder_pct_max', v)}
              unit={t('config.unit.pct')} min={1} max={100}
              hint={t('config.safety.max_holder_hint')}
            />
          </div>
        </Card>
      </div>
      </div>

      {walletOpen && <WalletModal onClose={() => setWalletOpen(false)} />}
    </div>
  )
}

// ── Sub-component: API Key block ─────────────────────────────────────
function ApiKeyBlock({ title, badge, tone, value, onChangeKey, urlValue, onChangeUrl, keyPlaceholder, keyLabel, urlLabel, setLabel }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="cp-modal-label !mb-1">{title}</span>
        <span className={clsx('cp-pill', tone === 'yellow' ? 'cp-pill-yellow' : 'cp-pill-blue')}>{badge}</span>
      </div>
      {value === '__set__' ? (
        <div className="cp-input-locked">
          <Icon name="lock" className="w-3.5 h-3.5 text-accent-green/70" />
          <span className="text-[14px] text-gray-200 font-mono tracking-wide font-semibold">{setLabel}</span>
        </div>
      ) : (
        <>
          <div>
            <label className="cp-modal-label">{keyLabel}</label>
            <input
              type="password"
              value={value}
              onChange={e => onChangeKey(e.target.value)}
              placeholder={keyPlaceholder}
              className="cp-input"
            />
          </div>
          <div>
            <label className="cp-modal-label">{urlLabel}</label>
            <input
              type="text"
              value={urlValue}
              onChange={e => onChangeUrl(e.target.value)}
              className="cp-input"
            />
          </div>
        </>
      )}
    </div>
  )
}

// ── Gas analysis panel (kept for /tab=gas usage) ─────────────────────
const REASON_ICON_NAME_G = {
  take_profit: 'target', stop_loss: 'shield', time_limit: 'clock',
  manual: 'pointer', zero_balance: 'skull', sell_failed: 'alert',
}
const REASON_ZH_G = {
  take_profit: '止盈', stop_loss: '止损', time_limit: '超时',
  manual: '手动', zero_balance: '归零', sell_failed: '放弃',
}

export function GasAnalysisPanel() {
  const [trades, setTrades] = useState([])
  const [stats, setStats] = useState(null)
  const [liveGas, setLiveGas] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    Promise.all([getTradeHistory(100, 0), getTradeStats()])
      .then(([t, s]) => { setTrades(t); setStats(s) })
      .catch(() => {})
    fetch('https://bsc-dataseed1.binance.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }),
    })
      .then(r => r.json())
      .then(d => {
        const gwei = parseInt(d.result, 16) / 1e9
        setLiveGas(gwei)
      })
      .catch(() => {})
  }, [])

  const withGas = trades.filter(t => t.gas_fee_usd > 0)
  const totalGas = withGas.reduce((s, t) => s + t.gas_fee_usd, 0)
  const avgGas = withGas.length ? totalGas / withGas.length : 0
  const totalNet = withGas.reduce((s, t) => s + (t.pnl_usdt || 0) - t.gas_fee_usd, 0)

  const byReason = withGas.reduce((acc, t) => {
    const k = t.reason
    if (!acc[k]) acc[k] = { count: 0, totalGas: 0, totalPnl: 0 }
    acc[k].count++
    acc[k].totalGas += t.gas_fee_usd
    acc[k].totalPnl += t.pnl_usdt || 0
    return acc
  }, {})

  const sorted = [...withGas].sort((a, b) => b.gas_fee_usd - a.gas_fee_usd)
  const shown = expanded ? sorted : sorted.slice(0, 10)

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-gray-200 mb-3">实时网络 Gas Price</h3>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-orange-400">
              {liveGas != null ? liveGas.toFixed(4) : '…'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Gwei (BSC)</div>
          </div>
          <div className="flex-1 text-xs text-gray-500 space-y-1">
            <div>当前设置 multiplier <span className="text-gray-300 font-mono">×1.2</span> → 实际约 <span className="font-mono text-orange-300">{liveGas != null ? (liveGas * 1.2).toFixed(4) : '…'} Gwei</span></div>
            <div>每笔 swap (300k gas) 预估 ≈ <span className="font-mono text-orange-300">{liveGas != null ? (300000 * liveGas * 1.2 / 1e9 * 600).toFixed(5) : '…'}U</span>（BNB@600U）</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gas 总计', value: `${totalGas.toFixed(3)}U`, color: 'text-orange-400' },
          { label: '均 Gas/笔', value: `${avgGas.toFixed(4)}U`, color: 'text-orange-300' },
          { label: '交易 P&L', value: `${((stats?.total_pnl_usdt || 0) >= 0 ? '+' : '') + (stats?.total_pnl_usdt || 0).toFixed(3)}U`, color: (stats?.total_pnl_usdt || 0) >= 0 ? 'text-accent-green' : 'text-red-400' },
          { label: '净盈亏(含Gas)', value: `${totalNet >= 0 ? '+' : ''}${totalNet.toFixed(3)}U`, color: totalNet >= 0 ? 'text-accent-green' : 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-dark-700 rounded-lg px-3 py-2 border border-dark-600">
            <div className="text-[10px] text-gray-500 mb-0.5">{s.label}</div>
            <div className={clsx('text-sm font-semibold font-mono', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-gray-200 mb-3">按卖出原因统计</h3>
        <div className="space-y-2">
          {Object.entries(byReason).sort((a, b) => b[1].totalGas - a[1].totalGas).map(([reason, d]) => (
            <div key={reason} className="flex items-center gap-3 text-xs">
              <span className="w-4 shrink-0 text-accent-green/80">
                <Icon name={REASON_ICON_NAME_G[reason] || 'info'} className="w-3.5 h-3.5" />
              </span>
              <span className="text-gray-300 w-10 shrink-0">{REASON_ZH_G[reason] || reason}</span>
              <span className="text-gray-500 w-8 shrink-0">{d.count}笔</span>
              <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500/50 rounded-full" style={{ width: `${totalGas > 0 ? d.totalGas / totalGas * 100 : 0}%` }} />
              </div>
              <span className="font-mono text-orange-400 w-16 text-right">{d.totalGas.toFixed(3)}U</span>
              <span className={clsx('font-mono w-16 text-right', (d.totalPnl - d.totalGas) >= 0 ? 'text-accent-green' : 'text-red-400')}>
                净{(d.totalPnl - d.totalGas) >= 0 ? '+' : ''}{(d.totalPnl - d.totalGas).toFixed(3)}U
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-gray-200 mb-3">每笔 Gas 明细（按消耗降序）</h3>
        <div className="space-y-1.5">
          {shown.map(t => {
            const display = t.symbol || t.token_name || (t.ca.slice(0, 6) + '…' + t.ca.slice(-4))
            const netPnl = (t.pnl_usdt || 0) - t.gas_fee_usd
            const barPct = totalGas > 0 ? Math.min(t.gas_fee_usd / totalGas * 100, 100) : 0
            return (
              <div key={t.id} className="flex items-center gap-2 text-xs group">
                <span className="shrink-0 text-accent-green/80">
                  <Icon name={REASON_ICON_NAME_G[t.reason] || 'info'} className="w-3.5 h-3.5" />
                </span>
                <span className="text-gray-300 w-20 shrink-0 truncate" title={display}>{display}</span>
                <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500/60 rounded-full" style={{ width: `${barPct}%` }} />
                </div>
                <span className="font-mono text-orange-400 w-16 text-right shrink-0">{t.gas_fee_usd.toFixed(4)}U</span>
                <span className={clsx('font-mono w-16 text-right shrink-0', netPnl >= 0 ? 'text-accent-green' : 'text-red-400')}>
                  净{netPnl >= 0 ? '+' : ''}{netPnl.toFixed(3)}U
                </span>
                <span className="text-gray-600 w-8 text-right shrink-0 text-[10px]">
                  {REASON_ZH_G[t.reason] || t.reason}
                </span>
              </div>
            )
          })}
        </div>
        {sorted.length > 10 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-gray-500 hover:text-gray-300 w-full text-center py-2 border-t border-dark-600 mt-2"
          >
            {expanded ? '收起' : `显示全部 ${sorted.length} 笔`}
          </button>
        )}
      </Card>
    </div>
  )
}
